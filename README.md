Smart Pantry - Food Waste Prevention App

Description
Smart Pantry is a mobile application that helps users reduce food waste by tracking pantry items, monitoring expiration dates, sharing surplus food with neighbors, and getting recipe suggestions based on available ingredients.

Tech Stack
Backend: Supabase (Database, Auth, Storage, Realtime)
Frontend: React Native (Expo)
Database: PostgreSQL (via Supabase)
Payment: (Optional / Future Plan)
Other:
Open Food Facts API (Barcode Scanning)
Expo Push Notifications
Lucide React Native (Icons)

Features
Pantry Management
Add items manually or by barcode scanning
Track expiration dates and get alerts for expiring items
Smart Notifications
Receive push notifications for items about to expire
Recipe Suggestions
Get recipes based on pantry contents
Food Sharing
Share excess food with nearby users
Real-time chat between users
Waste Tracking
Track discarded food and visualize waste reduction

Installation & Setup
git clone https://github.com/Collins06-okafor/smart-pantry.git
Navigate to the project directory:
cd smart-pantry
Install dependencies:
npm install
Run the app with Expo:
npx expo start
Set up your Supabase project:
Create tables: profile, pantry_items, shared_items, discarded_items, conversations, food_request_offers, food_requests, messages.
Add Supabase URL & API Key in lib/supabase.js.

API Documentation
https://collins-877468.postman.co/workspace/Collins's-Workspace~fd5a9b54-c852-4f2b-82c9-db8dad139193/collection/46084588-3516b154-e898-4fb0-9954-717570a530c0?action=share&source=copy-link&creator=46084588
https://collins-877468.postman.co/workspace/Collins's-Workspace~fd5a9b54-c852-4f2b-82c9-db8dad139193/collection/46084588-d73e4ad3-0b0d-453c-aa33-c1846afd45db?action=share&source=copy-link&creator=46084588

Live Demo

Screenshots
![IMG_5907](https://github.com/user-attachments/assets/935559d5-5b42-4cc1-99fa-a09f54275612)
![IMG_5910](https://github.com/user-attachments/assets/c35f02b9-eea2-4afc-b4d7-a0f5d90adb7d)
![IMG_5908](https://github.com/user-attachments/assets/f9c12c07-5d6e-4c36-aa60-c802a46936a4)
![IMG_5909](https://github.com/user-attachments/assets/e55dd045-b686-4257-86da-877bc5956b90)

Contributing
Contributions are welcome!
Fork the repo
Create a new branch: git checkout -b feature/your-feature
Submit a pull request

License
This project is licensed under the MIT License.
