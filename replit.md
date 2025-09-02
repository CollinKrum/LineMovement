# Sports Line Movement Tracker

## Overview

This is a sports betting line movement tracker application that monitors real-time pregame betting odds across major sports (NFL, NBA, MLB, NHL, NCAAF). The application provides users with line movement alerts, odds comparison across multiple sportsbooks, and tracking of significant market shifts. Built as a modern full-stack web application with React frontend and Express backend, it aims to help users identify profitable betting opportunities through comprehensive odds analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Design System**: Custom design system with consistent spacing, colors, and components

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful API with consistent error handling
- **Authentication**: Replit Auth integration with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage
- **Middleware**: Custom logging, CORS handling, and error boundaries

### Database Architecture
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Schema Design**: 
  - User management (users, sessions)
  - Sports data (sports, games, bookmakers)
  - Odds tracking (odds, line movements)
  - User features (favorites, alerts)
- **Migrations**: Drizzle Kit for schema management

### Data Integration
- **Odds Provider**: The Odds API for real-time sports betting data
- **Data Sync**: Automated syncing of sports, games, and odds data
- **Rate Limiting**: API usage tracking and optimization
- **Data Models**: Comprehensive schemas for sports betting markets including spreads, moneylines, and totals

### Authentication & Authorization
- **Provider**: Replit Auth with OIDC integration
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Security**: HTTP-only cookies, CSRF protection, secure session handling
- **User Management**: Profile data storage with social login integration

### Real-time Features
- **Line Movement Tracking**: Historical odds data with timestamp tracking
- **Alert System**: User-configurable alerts for significant line movements
- **Big Movers**: Automated detection of significant market shifts
- **Refresh Strategy**: Configurable data refresh intervals

## External Dependencies

### Core Services
- **The Odds API**: Primary data source for sports betting odds and line movements
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit Auth**: Authentication and user management service

### Development & Deployment
- **Replit Platform**: Primary hosting and development environment
- **Vite**: Frontend build tool and development server
- **TypeScript**: Type safety across frontend and backend

### UI & Styling
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide Icons**: Icon library for consistent iconography
- **Google Fonts**: Typography (Inter, DM Sans, Geist Mono)

### Data & State Management
- **TanStack Query**: Server state synchronization and caching
- **Drizzle ORM**: Type-safe database operations
- **Zod**: Runtime type validation and schema parsing

### Utilities & Tools
- **date-fns**: Date manipulation and formatting
- **clsx**: Conditional CSS class handling
- **nanoid**: Unique ID generation
- **memoizee**: Function memoization for performance optimization