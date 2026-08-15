# Welliva - AI-Powered Fitness & Nutrition App 💪🥗

A comprehensive fitness and nutrition tracking app built with React Native (Expo), Supabase backend, and Google's Gemini AI.

## ✨ Features

- 📊 **User Profile & Progress Tracking** - Track weight, height, goals, and level up with XP
- 🍽️ **Smart Meal Planning** - AI-generated meal plans (daily/weekly) with automatic refresh
- 📱 **Nutrition Logging** - Track meals, calories, and macros with detailed history
- 🏋️ **Workout Tracking** - Create, log, and complete workouts with exercise details
- 🏆 **Achievement System** - Unlock achievements and earn XP for consistency
- 💧 **Water Tracking** - Log daily water intake and monitor hydration
- 🔥 **Streak Tracking** - Maintain streaks for meals, workouts, and water intake
- 🍲 **Custom Meals** - Create and save your own recipes with nutrition data
- 🎨 **Theme Support** - Light/dark mode with beautiful UI
- ☁️ **Cloud Sync** - Data syncs to Supabase PostgreSQL

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Expo CLI
- Supabase account (free at [supabase.com](https://supabase.com))

### Installation

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up Supabase backend**

   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run the contents of `supabase/schema.sql`
   - Enable Email, Google, and Facebook OAuth in Authentication → Providers
   - See `docs/OAUTH_SETUP.md` for detailed OAuth configuration

3. **Configure environment**
   Create a `.env` file:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Start the app**
   ```bash
   npx expo start
   ```

## 📖 Documentation

- **[supabase/schema.sql](supabase/schema.sql)** - Database schema and RLS policies
- **[lib/database.types.ts](lib/database.types.ts)** - TypeScript types for database
- **[hooks/useSupabase.ts](hooks/useSupabase.ts)** - Database hooks
- **[docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md)** - OAuth configuration guide
- **[docs/MIGRATION_SUMMARY.md](docs/MIGRATION_SUMMARY.md)** - Clerk/Convex → Supabase migration summary
- **[docs/AUTH_QUICK_REFERENCE.md](docs/AUTH_QUICK_REFERENCE.md)** - Authentication quick reference

## 🏗️ Tech Stack

### Frontend

- **React Native** (Expo) - Cross-platform mobile development
- **TypeScript** - Type-safe development
- **React Navigation** - Navigation and routing
- **Expo Router** - File-based routing

### Backend

- **Supabase** - PostgreSQL database with Row Level Security
- **Supabase Auth** - OAuth authentication (Email/Password, Google, Facebook)

### AI & Services

- **Google Gemini AI** - AI-powered meal plan generation

## 📁 Project Structure

```
welliva/
├── app/                          # Expo Router screens
│   ├── (tabs)/                   # Tab navigation screens
│   │   ├── index.tsx             # Home/Dashboard
│   │   ├── meals.tsx             # Meal planning
│   │   ├── fitness.tsx           # Workouts
│   │   ├── stats.tsx             # Statistics
│   │   └── profile.tsx           # User profile
│   └── _layout.tsx               # Root layout with providers
│
├── components/                   # Reusable components
│   ├── SupabaseAuthProvider.tsx  # Authentication provider
│   ├── DataMigrationModal.tsx    # Data migration UI
│   ├── MealPlanContext.tsx       # Meal plan state
│   ├── NutritionContext.tsx      # Nutrition tracking
│   ├── WorkoutContext.tsx        # Workout state
│   ├── AchievementsContext.tsx   # Achievement system
│   └── ...                       # Other components
│
├── lib/                          # Core libraries
│   ├── supabase.ts               # Supabase client
│   └── database.types.ts         # TypeScript types
│
├── supabase/                     # Supabase configuration
│   └── schema.sql                # Database schema with RLS
│
├── hooks/                        # Custom React hooks
│   └── useSupabase.ts            # Supabase data hooks
│
├── services/                     # Service layer
│   ├── MigrationService.ts       # AsyncStorage → Supabase migration
│   ├── GeminiService.ts          # AI meal generation
│   └── ...                       # Other services
│
├── constants/                    # App constants
│   ├── DietDatabase.ts           # Hand-authored diets + meal options
│   ├── FoodDictionary.ts         # Whole-foods catalog (loaded from Storage)
│   └── theme.ts                  # Theme configuration
│
└── assets/                       # Images, fonts, etc.
```

## 💾 Database Schema

### Main Tables

- **users** - User profiles, preferences, level/XP
- **meal_plans** - Diet plans with schedule settings
- **nutrition_logs** - Daily meal tracking
- **workouts** - Exercise sessions and completion
- **achievements** - Unlockable achievements
- **custom_meals** - User-created recipes
- **water_logs** - Daily hydration tracking
- **streaks** - Consistency tracking
- **consumed_meals** - Daily meal consumption tracking
- **custom_diets** - Custom diet configurations

See `supabase/schema.sql` for the full schema with RLS policies.

## 🎯 Usage Examples

### Get User Profile

```typescript
import { useCurrentUser } from "@/hooks/useSupabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";

const { user } = useSupabaseAuth();
const { profile, updateUser } = useCurrentUser(user?.id || null);
await updateUser({ weight: 75 });
```

### Log a Meal

```typescript
import { useNutritionLogs } from "@/hooks/useSupabase";

const { logMeal } = useNutritionLogs(userId);
await logMeal({
  date: today,
  meal_type: "breakfast",
  meal_name: "Eggs",
  calories: 300,
  protein: 25,
  carbs: 5,
  fats: 20,
  is_custom_meal: false,
});
```

### Create Workout

```typescript
import { useWorkouts } from "@/hooks/useSupabase";

const { createWorkout } = useWorkouts(userId);
await createWorkout({
  name: "Upper Body",
  type: "strength",
  duration: 3600,
  calories_burned: 400,
  exercises: [...],
});
```

## 🔧 Development

### Available Scripts

```bash
npm start              # Start Expo
npm run android        # Open Android emulator
npm run ios            # Open iOS simulator
npm run web            # Open web browser
npm run lint           # Run ESLint
```

### Development Workflow

1. Create Supabase project and run `schema.sql`
2. Set up `.env` with Supabase credentials
3. Start Expo: `npx expo start`
4. Open app in Expo Go or simulator
5. Make changes - hot reload works for frontend

### View Data

- Supabase Dashboard: [app.supabase.com](https://app.supabase.com)
- View tables, run SQL queries, check logs
- Test database functions manually

## 🚀 Deployment

### Backend (Supabase)

Already deployed! Supabase manages your backend automatically.

### Frontend (Expo)

```bash
# Build for production
eas build --platform android
eas build --platform ios

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

## 📱 Migration from Local Storage

The app includes automatic migration from AsyncStorage to Supabase:

1. Detects existing local data
2. Shows migration prompt
3. Migrates all data to cloud
4. Marks migration complete

See [MigrationService.ts](services/MigrationService.ts) for details.

## 🔐 Security

### Current Implementation

- ✅ Row Level Security (RLS) on all tables
- ✅ OAuth authentication (Google, Apple)
- ✅ Data validation
- ✅ User data isolation

### Production Checklist

- [x] Add authentication (Supabase Auth)
- [x] Implement row-level security
- [ ] Add rate limiting
- [ ] Configure backups

## 🐛 Troubleshooting

| Issue                         | Solution                                        |
| ----------------------------- | ----------------------------------------------- |
| "Supabase URL not configured" | Add `EXPO_PUBLIC_SUPABASE_URL` to `.env`        |
| "Auth error"                  | Check OAuth configuration in Supabase dashboard |
| "Permission denied"           | Check RLS policies in Supabase SQL Editor       |
| "Network error"               | Verify Supabase project is active               |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **Supabase** - Backend platform
- **Expo** - React Native framework
- **Google Gemini AI** - AI-powered meal generation
- **React Native Community** - Amazing ecosystem

## 📞 Support

- [GitHub Issues](https://github.com/yourusername/welliva/issues)
- [Supabase Discord](https://discord.supabase.com)
- [Expo Discord](https://chat.expo.dev)

## 🎉 Getting Started Checklist

- [ ] Install dependencies (`npm install`)
- [ ] Create Supabase project
- [ ] Run `supabase/schema.sql` in SQL Editor
- [ ] Create `.env` file with Supabase credentials
- [ ] Configure OAuth providers (Google, Apple)
- [ ] Start app (`npx expo start`)
- [ ] Test basic features
- [ ] Start building!

---

**Built with ❤️ using React Native, Expo, and Supabase**
