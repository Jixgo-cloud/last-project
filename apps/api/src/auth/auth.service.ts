import { Injectable, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { UserRole, VerificationStatus, AuthUserResponse } from '@smartcareer/shared';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: {
    email: string;
    password: string;
    role: UserRole;
    fullName?: string;
    companyName?: string;
    targetCareer?: string;
  }): Promise<AuthUserResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        role: dto.role,
      },
    });

    let candidateProfileData = null;
    let companyData = null;

    if (dto.role === UserRole.CANDIDATE) {
      const profile = await this.prisma.candidateProfile.create({
        data: {
          userId: user.id,
          fullName: dto.fullName || dto.email.split('@')[0],
          targetCareer: dto.targetCareer || 'Full Stack Developer',
        },
      });
      candidateProfileData = {
        id: profile.id,
        fullName: profile.fullName,
        targetCareer: profile.targetCareer,
        githubUsername: profile.githubUsername,
      };
    } else if (dto.role === UserRole.COMPANY) {
      const companyName = dto.companyName || `${dto.email.split('@')[0]} Tech`;
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
      const company = await this.prisma.company.create({
        data: {
          name: companyName,
          slug,
          verificationStatus: VerificationStatus.PENDING,
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });
      companyData = {
        id: company.id,
        name: company.name,
        verificationStatus: company.verificationStatus as VerificationStatus,
      };
    }

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
      candidateProfile: candidateProfileData,
      company: companyData,
      token,
    };
  }

  async login(dto: { email: string; password: string }): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        candidateProfile: true,
        companyMembers: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        `This account was registered using ${user.authProvider} login. Please continue with ${user.authProvider}.`
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const candidateProfile = user.candidateProfile
      ? {
          id: user.candidateProfile.id,
          fullName: user.candidateProfile.fullName,
          targetCareer: user.candidateProfile.targetCareer,
          githubUsername: user.candidateProfile.githubUsername,
        }
      : null;

    const companyMember = user.companyMembers[0];
    const company = companyMember?.company
      ? {
          id: companyMember.company.id,
          name: companyMember.company.name,
          verificationStatus: companyMember.company.verificationStatus as VerificationStatus,
        }
      : null;

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
      candidateProfile,
      company,
      token,
    };
  }

  async handleOAuthUser(dto: {
    provider: 'GOOGLE' | 'GITHUB';
    providerId: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    githubUsername?: string;
    targetCareer?: string;
    requestedRole?: UserRole;
  }): Promise<AuthUserResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Strict constraint check: Candidate cannot use Google!
    if (dto.provider === 'GOOGLE' && dto.requestedRole === UserRole.CANDIDATE) {
      throw new BadRequestException('Google sign-in and registration are reserved for Company accounts. Candidates must use GitHub.');
    }

    // Strict constraint check: Company cannot use GitHub!
    if (dto.provider === 'GITHUB' && dto.requestedRole === UserRole.COMPANY) {
      throw new BadRequestException('GitHub sign up is not permitted for company accounts. Companies must use Google.');
    }

    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        candidateProfile: true,
        companyMembers: {
          include: {
            company: true,
          },
        },
      },
    });

    if (user) {
      if (user.role === UserRole.COMPANY && dto.provider === 'GITHUB') {
        throw new BadRequestException('Company accounts cannot sign in with GitHub. Please use Google or Email.');
      }

      if (user.role === UserRole.CANDIDATE && dto.provider === 'GOOGLE') {
        throw new BadRequestException('Candidate accounts cannot sign in with Google. Please use GitHub.');
      }

      // Update provider information and avatar if newly available
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          authProvider: dto.provider as any,
          providerId: dto.providerId,
          avatarUrl: user.avatarUrl || dto.avatarUrl,
        },
        include: {
          candidateProfile: true,
          companyMembers: {
            include: {
              company: true,
            },
          },
        },
      });

      if (user.role === UserRole.CANDIDATE && user.candidateProfile) {
        // If githubUsername is already bound, verify it matches
        if (dto.githubUsername && user.candidateProfile.githubUsername) {
          if (user.candidateProfile.githubUsername.toLowerCase() !== dto.githubUsername.toLowerCase()) {
            throw new BadRequestException(
              `This account is permanently locked to GitHub @${user.candidateProfile.githubUsername}. You cannot sign in with @${dto.githubUsername}.`,
            );
          }
        }

        // If not bound yet, ensure no other candidate profile has this username
        if (dto.githubUsername && !user.candidateProfile.githubUsername) {
          const taken = await this.prisma.candidateProfile.findUnique({
            where: { githubUsername: dto.githubUsername },
          });
          if (taken && taken.id !== user.candidateProfile.id) {
            throw new ConflictException(
              `The GitHub account @${dto.githubUsername} is already linked to another SmartCareer user.`,
            );
          }
        }

        const updateData: any = {};
        if (dto.githubUsername && !user.candidateProfile.githubUsername) {
          updateData.githubUsername = dto.githubUsername;
        }
        if (dto.avatarUrl && !user.candidateProfile.avatarUrl) {
          updateData.avatarUrl = dto.avatarUrl;
        }
        if (Object.keys(updateData).length > 0) {
          const updatedProfile = await this.prisma.candidateProfile.update({
            where: { id: user.candidateProfile.id },
            data: updateData,
          });
          user.candidateProfile = updatedProfile;
        }
      }
    } else {
      // New user registration
      const role = dto.requestedRole || (dto.provider === 'GITHUB' ? UserRole.CANDIDATE : UserRole.COMPANY);
      if (role === UserRole.COMPANY && dto.provider === 'GITHUB') {
        throw new BadRequestException('GitHub sign up is not permitted for company accounts.');
      }
      if (role === UserRole.CANDIDATE && dto.provider === 'GOOGLE') {
        throw new BadRequestException('Google sign up is not permitted for Candidate accounts. Candidates must use GitHub.');
      }

      // 1 Account per 1 GitHub: Check uniqueness before creating user
      if (role === UserRole.CANDIDATE && dto.githubUsername) {
        const taken = await this.prisma.candidateProfile.findUnique({
          where: { githubUsername: dto.githubUsername },
        });
        if (taken) {
          throw new ConflictException(
            `The GitHub account @${dto.githubUsername} is already linked to another SmartCareer user.`,
          );
        }
      }

      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: null,
          role,
          authProvider: dto.provider as any,
          providerId: dto.providerId,
          avatarUrl: dto.avatarUrl,
        },
        include: {
          candidateProfile: true,
          companyMembers: {
            include: {
              company: true,
            },
          },
        },
      });

      if (role === UserRole.CANDIDATE) {
        const profile = await this.prisma.candidateProfile.create({
          data: {
            userId: user.id,
            fullName: dto.fullName || normalizedEmail.split('@')[0],
            targetCareer: dto.targetCareer || 'Full Stack Developer',
            githubUsername: dto.githubUsername || null,
            avatarUrl: dto.avatarUrl || null,
          },
        });
        (user as any).candidateProfile = profile;
      } else if (role === UserRole.COMPANY) {
        const personName = dto.fullName || normalizedEmail.split('@')[0];
        const companyName = `${personName}'s Organization`;
        const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
        const company = await this.prisma.company.create({
          data: {
            name: companyName,
            slug,
            verificationStatus: VerificationStatus.PENDING,
            members: {
              create: {
                userId: user.id,
                role: 'OWNER',
              },
            },
          },
        });
        (user as any).companyMembers = [{ company }];
      }
    }

    const candidateProfile = user.candidateProfile
      ? {
          id: user.candidateProfile.id,
          fullName: user.candidateProfile.fullName,
          targetCareer: user.candidateProfile.targetCareer,
          githubUsername: user.candidateProfile.githubUsername,
        }
      : null;

    const companyMember = user.companyMembers?.[0];
    const company = companyMember?.company
      ? {
          id: companyMember.company.id,
          name: companyMember.company.name,
          verificationStatus: companyMember.company.verificationStatus as VerificationStatus,
        }
      : null;

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
      candidateProfile,
      company,
      token,
    };
  }

  async getMe(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        candidateProfile: true,
        companyMembers: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const candidateProfile = user.candidateProfile
      ? {
          id: user.candidateProfile.id,
          fullName: user.candidateProfile.fullName,
          targetCareer: user.candidateProfile.targetCareer,
          githubUsername: user.candidateProfile.githubUsername,
        }
      : null;

    const companyMember = user.companyMembers[0];
    const company = companyMember?.company
      ? {
          id: companyMember.company.id,
          name: companyMember.company.name,
          verificationStatus: companyMember.company.verificationStatus as VerificationStatus,
        }
      : null;

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
      candidateProfile,
      company,
      token,
    };
  }

  private generateToken(userId: string, email: string, role: string): string {
    return this.jwtService.sign({
      sub: userId,
      email,
      role,
    });
  }
}
