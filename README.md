# Mayur Learn Hub

Build a comprehensive, modern, fast, and feature-rich Learning Management System (LMS) app called "Mayur Education". The primary interface language should be English.



Please implement ALL of the following features and structures from scratch in a single build:



1. **User Authentication & Simple Login:**

   - Simple Signup and Login system requesting ONLY: Username, Mobile Number, and Password (No OTP required).

   - Students must log in to access tests and save their progress.



2. **Core Content Hierarchy (3-Tier LMS Structure):**

   - Structure: Subjects > Chapters > Tests (e.g., Test 1, Test 2, Test 3).

   - Each test consists of Multiple-Choice Questions (MCQs) with 4 options, correct answer validation, and detailed explanations.



3. **Test-Taking Interface & Anti-Cheating System:**

   - Active countdown timer for tests.

   - Instant test results upon submission (Total score, correct/incorrect review).

   - **Proctoring / Anti-Cheating Tracking:** Automatically detect and count if a student switches tabs, minimizes the app, or presses the back button during a test. Track time spent per test.

   - **VIP Exclusive Hint Button:** Include a "💡 Hint" button on questions that is ONLY unlocked for students with an active 'VIP Badge'. Lock it for non-VIP users.

   - "Report Error" option on questions so users can report issues.

   - "Revision/Bookmark" section to save and review incorrectly answered questions.



4. **Gamification & VIP System:**

   - **Streak Logic:** Automatically award a 'VIP Badge' to students who continuously complete at least 2 tests or chapters back-to-back.

   - **VIP Board (Leaderboard):** Highlight VIP achievers on the homepage.

   - **Global Header VIP Ticker:** Display "👑 Current Top VIP: [Student Name]" permanently on the top navigation bar/header across all pages to drive healthy competition.



5. **Student Dashboard ("My Dashboard"):**

   - Personal dashboard for logged-in students showing:

     - VIP Status (Active/Inactive Badge).

     - Total scores and cumulative marks.

     - Summary of practiced subjects and completed chapters.



6. **Comprehensive Admin Dashboard:**

   - Admin Login with password access.

   - Full Dynamic CRUD: Create, Edit, and Delete Subjects, Chapters, Tests, and Question banks easily.

   - **Student Monitoring & Anti-Cheating Records:**

     - List of all registered students with Username and Mobile Number.

     - Total tests taken, completed subjects/chapters, and total marks.

     - Student 'Back/Tab-Switch Count' (cheating monitor) and test completion time.

   - **Instant Search Bar:** Search bar at the top of the Admin Panel to search students by Name or Mobile Number.



7. **UI & Social Engagement Features:**

   - Dark Mode / Light Mode toggle.

   - "Share Result on WhatsApp" button on test completion screens to make the app go viral.

   - Clean, modern, 

mobile-first design with smooth navigation.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://smartlearn-vip-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ac11e124-936c-4808-925c-b86ab233a245).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
