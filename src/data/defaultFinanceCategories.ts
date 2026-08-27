import { FinanceCategory } from '../types';

const nowStr = new Date().toISOString();
const nowTs = Date.now();

export const DEFAULT_FINANCE_CATEGORIES: FinanceCategory[] = [
  // ================= EXPENSES =================
  // Housing & Home
  { id: 'exp_housing', name: 'Housing & Home', type: 'expense', icon: '🏠', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_housing_rent', name: 'Rent', type: 'expense', parentId: 'exp_housing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_housing_maintenance', name: 'Home Maintenance', type: 'expense', parentId: 'exp_housing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_housing_furniture', name: 'Furniture', type: 'expense', parentId: 'exp_housing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_housing_supplies', name: 'Home Supplies', type: 'expense', parentId: 'exp_housing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_housing_cleaning', name: 'Cleaning', type: 'expense', parentId: 'exp_housing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_housing_other', name: 'Other Housing', type: 'expense', parentId: 'exp_housing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Food & Dining
  { id: 'exp_food', name: 'Food & Dining', type: 'expense', icon: '🍔', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_food_groceries', name: 'Groceries', type: 'expense', parentId: 'exp_food', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_food_restaurants', name: 'Restaurants', type: 'expense', parentId: 'exp_food', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_food_coffee', name: 'Coffee', type: 'expense', parentId: 'exp_food', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_food_delivery', name: 'Delivery', type: 'expense', parentId: 'exp_food', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_food_snacks', name: 'Snacks', type: 'expense', parentId: 'exp_food', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_food_other', name: 'Other Food', type: 'expense', parentId: 'exp_food', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Shopping
  { id: 'exp_shopping', name: 'Shopping', type: 'expense', icon: '🛒', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_shopping_general', name: 'General Shopping', type: 'expense', parentId: 'exp_shopping', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_shopping_electronics', name: 'Electronics', type: 'expense', parentId: 'exp_shopping', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_shopping_personal', name: 'Personal Items', type: 'expense', parentId: 'exp_shopping', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_shopping_online', name: 'Online Shopping', type: 'expense', parentId: 'exp_shopping', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_shopping_other', name: 'Other Shopping', type: 'expense', parentId: 'exp_shopping', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Transportation
  { id: 'exp_transportation', name: 'Transportation', type: 'expense', icon: '🚗', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_transportation_public', name: 'Public Transportation', type: 'expense', parentId: 'exp_transportation', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_transportation_fuel', name: 'Fuel', type: 'expense', parentId: 'exp_transportation', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_transportation_taxi', name: 'Taxi & Ride Sharing', type: 'expense', parentId: 'exp_transportation', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_transportation_maintenance', name: 'Car Maintenance', type: 'expense', parentId: 'exp_transportation', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_transportation_parking', name: 'Parking', type: 'expense', parentId: 'exp_transportation', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_transportation_insurance', name: 'Car Insurance', type: 'expense', parentId: 'exp_transportation', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_transportation_other', name: 'Other Transportation', type: 'expense', parentId: 'exp_transportation', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Phone & Internet
  { id: 'exp_phone_internet', name: 'Phone & Internet', type: 'expense', icon: '📱', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_phone_mobile', name: 'Mobile', type: 'expense', parentId: 'exp_phone_internet', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_phone_internet_home', name: 'Internet', type: 'expense', parentId: 'exp_phone_internet', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_phone_other', name: 'Other Communication', type: 'expense', parentId: 'exp_phone_internet', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Utilities
  { id: 'exp_utilities', name: 'Utilities', type: 'expense', icon: '💡', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_utilities_electricity', name: 'Electricity', type: 'expense', parentId: 'exp_utilities', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_utilities_water', name: 'Water', type: 'expense', parentId: 'exp_utilities', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_utilities_gas', name: 'Gas', type: 'expense', parentId: 'exp_utilities', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_utilities_other', name: 'Other Utilities', type: 'expense', parentId: 'exp_utilities', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Health
  { id: 'exp_health', name: 'Health', type: 'expense', icon: '🏥', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_health_doctor', name: 'Doctor', type: 'expense', parentId: 'exp_health', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_health_medicine', name: 'Medicine', type: 'expense', parentId: 'exp_health', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_health_dental', name: 'Dental', type: 'expense', parentId: 'exp_health', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_health_tests', name: 'Medical Tests', type: 'expense', parentId: 'exp_health', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_health_insurance', name: 'Health Insurance', type: 'expense', parentId: 'exp_health', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_health_other', name: 'Other Health', type: 'expense', parentId: 'exp_health', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Clothing
  { id: 'exp_clothing', name: 'Clothing', type: 'expense', icon: '👕', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_clothing_clothes', name: 'Clothes', type: 'expense', parentId: 'exp_clothing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_clothing_shoes', name: 'Shoes', type: 'expense', parentId: 'exp_clothing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_clothing_accessories', name: 'Accessories', type: 'expense', parentId: 'exp_clothing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_clothing_laundry', name: 'Laundry', type: 'expense', parentId: 'exp_clothing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_clothing_other', name: 'Other Clothing', type: 'expense', parentId: 'exp_clothing', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Entertainment
  { id: 'exp_entertainment', name: 'Entertainment', type: 'expense', icon: '🎮', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_entertainment_movies', name: 'Movies', type: 'expense', parentId: 'exp_entertainment', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_entertainment_games', name: 'Games', type: 'expense', parentId: 'exp_entertainment', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_entertainment_hobbies', name: 'Hobbies', type: 'expense', parentId: 'exp_entertainment', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_entertainment_events', name: 'Events', type: 'expense', parentId: 'exp_entertainment', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_entertainment_other', name: 'Other Entertainment', type: 'expense', parentId: 'exp_entertainment', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Education
  { id: 'exp_education', name: 'Education', type: 'expense', icon: '🎓', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_education_courses', name: 'Courses', type: 'expense', parentId: 'exp_education', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_education_books', name: 'Books', type: 'expense', parentId: 'exp_education', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_education_training', name: 'Training', type: 'expense', parentId: 'exp_education', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_education_school', name: 'School / University', type: 'expense', parentId: 'exp_education', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_education_other', name: 'Other Education', type: 'expense', parentId: 'exp_education', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Travel
  { id: 'exp_travel', name: 'Travel', type: 'expense', icon: '✈️', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_travel_flights', name: 'Flights', type: 'expense', parentId: 'exp_travel', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_travel_hotels', name: 'Hotels', type: 'expense', parentId: 'exp_travel', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_travel_transportation', name: 'Travel Transportation', type: 'expense', parentId: 'exp_travel', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_travel_food', name: 'Travel Food', type: 'expense', parentId: 'exp_travel', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_travel_activities', name: 'Travel Activities', type: 'expense', parentId: 'exp_travel', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_travel_other', name: 'Other Travel', type: 'expense', parentId: 'exp_travel', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Gifts & Donations
  { id: 'exp_gifts_donations', name: 'Gifts & Donations', type: 'expense', icon: '🎁', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_gifts', name: 'Gifts', type: 'expense', parentId: 'exp_gifts_donations', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_donations_charity', name: 'Charity', type: 'expense', parentId: 'exp_gifts_donations', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_donations_general', name: 'Donations', type: 'expense', parentId: 'exp_gifts_donations', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_gifts_other', name: 'Other', type: 'expense', parentId: 'exp_gifts_donations', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Family
  { id: 'exp_family', name: 'Family', type: 'expense', icon: '👨‍👩‍👧', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_family_support', name: 'Family Support', type: 'expense', parentId: 'exp_family', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_family_children', name: 'Children', type: 'expense', parentId: 'exp_family', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_family_parents', name: 'Parents', type: 'expense', parentId: 'exp_family', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_family_other', name: 'Other Family', type: 'expense', parentId: 'exp_family', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Pets
  { id: 'exp_pets', name: 'Pets', type: 'expense', icon: '🐱', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_pets_food', name: 'Pet Food', type: 'expense', parentId: 'exp_pets', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_pets_veterinary', name: 'Veterinary', type: 'expense', parentId: 'exp_pets', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_pets_supplies', name: 'Pet Supplies', type: 'expense', parentId: 'exp_pets', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_pets_other', name: 'Other Pets', type: 'expense', parentId: 'exp_pets', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Banking & Fees
  { id: 'exp_banking', name: 'Banking & Fees', type: 'expense', icon: '💳', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_banking_bank_fees', name: 'Bank Fees', type: 'expense', parentId: 'exp_banking', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_banking_card_fees', name: 'Card Fees', type: 'expense', parentId: 'exp_banking', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_banking_atm_fees', name: 'ATM Fees', type: 'expense', parentId: 'exp_banking', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_banking_exchange_fees', name: 'Exchange Fees', type: 'expense', parentId: 'exp_banking', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_banking_other', name: 'Other Financial Fees', type: 'expense', parentId: 'exp_banking', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Sports & Fitness
  { id: 'exp_sports_fitness', name: 'Sports & Fitness', type: 'expense', icon: '🏋️', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_sports_gym', name: 'Gym', type: 'expense', parentId: 'exp_sports_fitness', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_sports_equipment', name: 'Sports Equipment', type: 'expense', parentId: 'exp_sports_fitness', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_sports_activities', name: 'Sports Activities', type: 'expense', parentId: 'exp_sports_fitness', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_sports_other', name: 'Other Fitness', type: 'expense', parentId: 'exp_sports_fitness', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Subscriptions
  { id: 'exp_subscriptions', name: 'Subscriptions', type: 'expense', icon: '📦', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_subs_streaming', name: 'Streaming', type: 'expense', parentId: 'exp_subscriptions', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_subs_music', name: 'Music', type: 'expense', parentId: 'exp_subscriptions', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_subs_software', name: 'Software', type: 'expense', parentId: 'exp_subscriptions', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_subs_cloud', name: 'Cloud Storage', type: 'expense', parentId: 'exp_subscriptions', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_subs_memberships', name: 'Memberships', type: 'expense', parentId: 'exp_subscriptions', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_subs_other', name: 'Other Subscriptions', type: 'expense', parentId: 'exp_subscriptions', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Investments
  { id: 'exp_investments', name: 'Investments', type: 'expense', icon: '💰', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_investments_gold', name: 'Gold', type: 'expense', parentId: 'exp_investments', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_investments_stocks', name: 'Stocks', type: 'expense', parentId: 'exp_investments', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_investments_funds', name: 'Funds', type: 'expense', parentId: 'exp_investments', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_investments_real_estate', name: 'Real Estate', type: 'expense', parentId: 'exp_investments', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_investments_other', name: 'Other Investments', type: 'expense', parentId: 'exp_investments', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Work & Business
  { id: 'exp_work_business', name: 'Work & Business', type: 'expense', icon: '📚', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_work_equipment', name: 'Work Equipment', type: 'expense', parentId: 'exp_work_business', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_work_transportation', name: 'Work Transportation', type: 'expense', parentId: 'exp_work_business', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_work_expenses', name: 'Business Expenses', type: 'expense', parentId: 'exp_work_business', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_work_services', name: 'Professional Services', type: 'expense', parentId: 'exp_work_business', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_work_other', name: 'Other Work', type: 'expense', parentId: 'exp_work_business', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Maintenance
  { id: 'exp_maintenance', name: 'Maintenance', type: 'expense', icon: '🔧', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_maintenance_electronics', name: 'Electronics Repair', type: 'expense', parentId: 'exp_maintenance', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_maintenance_vehicle', name: 'Vehicle Repair', type: 'expense', parentId: 'exp_maintenance', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_maintenance_home', name: 'Home Repair', type: 'expense', parentId: 'exp_maintenance', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_maintenance_other', name: 'Other Maintenance', type: 'expense', parentId: 'exp_maintenance', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Taxes & Government
  { id: 'exp_taxes_gov', name: 'Taxes & Government', type: 'expense', icon: '🧾', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_taxes', name: 'Taxes', type: 'expense', parentId: 'exp_taxes_gov', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_gov_fees', name: 'Government Fees', type: 'expense', parentId: 'exp_taxes_gov', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_gov_documents', name: 'Documents', type: 'expense', parentId: 'exp_taxes_gov', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_gov_licenses', name: 'Licenses', type: 'expense', parentId: 'exp_taxes_gov', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_gov_other', name: 'Other Government', type: 'expense', parentId: 'exp_taxes_gov', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Other Expense
  { id: 'exp_other', name: 'Other', type: 'expense', icon: '❓', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'exp_other_general', name: 'Other Expense', type: 'expense', parentId: 'exp_other', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // ================= INCOME =================
  
  // Salary
  { id: 'inc_salary_parent', name: 'Salary', type: 'income', icon: '💼', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_salary', name: 'Salary', type: 'income', parentId: 'inc_salary_parent', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_salary_bonus', name: 'Bonus', type: 'income', parentId: 'inc_salary_parent', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_salary_overtime', name: 'Overtime', type: 'income', parentId: 'inc_salary_parent', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_salary_other', name: 'Other Salary', type: 'income', parentId: 'inc_salary_parent', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Teaching Income
  { id: 'inc_teaching', name: 'Teaching Income', type: 'income', icon: '👨‍🏫', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_teaching_private', name: 'Private Lessons', type: 'income', parentId: 'inc_teaching', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_teaching_group', name: 'Group Lessons', type: 'income', parentId: 'inc_teaching', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_teaching_online', name: 'Online Lessons', type: 'income', parentId: 'inc_teaching', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_teaching_materials', name: 'Teaching Materials', type: 'income', parentId: 'inc_teaching', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_teaching_other', name: 'Other Teaching Income', type: 'income', parentId: 'inc_teaching', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Freelance
  { id: 'inc_freelance', name: 'Freelance', type: 'income', icon: '💻', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_freelance_projects', name: 'Freelance Projects', type: 'income', parentId: 'inc_freelance', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_freelance_consulting', name: 'Consulting', type: 'income', parentId: 'inc_freelance', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_freelance_digital', name: 'Digital Services', type: 'income', parentId: 'inc_freelance', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_freelance_other', name: 'Other Freelance', type: 'income', parentId: 'inc_freelance', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Business
  { id: 'inc_business', name: 'Business', type: 'income', icon: '🏢', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_business_revenue', name: 'Business Revenue', type: 'income', parentId: 'inc_business', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_business_sales', name: 'Sales', type: 'income', parentId: 'inc_business', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_business_services', name: 'Services', type: 'income', parentId: 'inc_business', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_business_other', name: 'Other Business Income', type: 'income', parentId: 'inc_business', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Investment Returns
  { id: 'inc_investments', name: 'Investment Returns', type: 'income', icon: '📈', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_investments_gold', name: 'Gold Returns', type: 'income', parentId: 'inc_investments', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_investments_stocks', name: 'Stock Returns', type: 'income', parentId: 'inc_investments', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_investments_funds', name: 'Fund Returns', type: 'income', parentId: 'inc_investments', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_investments_real_estate', name: 'Real Estate Income', type: 'income', parentId: 'inc_investments', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_investments_other', name: 'Other Investment Returns', type: 'income', parentId: 'inc_investments', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Interest / Bank Returns
  { id: 'inc_interest_bank', name: 'Interest / Bank Returns', type: 'income', icon: '🏦', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_interest_bank_interest', name: 'Bank Interest', type: 'income', parentId: 'inc_interest_bank', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_interest_savings', name: 'Savings Returns', type: 'income', parentId: 'inc_interest_bank', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_interest_investment_account', name: 'Investment Account Returns', type: 'income', parentId: 'inc_interest_bank', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_interest_other', name: 'Other Bank Returns', type: 'income', parentId: 'inc_interest_bank', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Gifts
  { id: 'inc_gifts', name: 'Gifts', type: 'income', icon: '🎁', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_gifts_received', name: 'Gift Received', type: 'income', parentId: 'inc_gifts', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_gifts_family', name: 'Family Support', type: 'income', parentId: 'inc_gifts', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_gifts_other', name: 'Other Gifts', type: 'income', parentId: 'inc_gifts', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Transfers Received
  { id: 'inc_transfers', name: 'Transfers Received', type: 'income', icon: '💸', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_transfers_money', name: 'Money Received', type: 'income', parentId: 'inc_transfers', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_transfers_reimbursement', name: 'Reimbursement', type: 'income', parentId: 'inc_transfers', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_transfers_other', name: 'Other Transfer Income', type: 'income', parentId: 'inc_transfers', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Refunds
  { id: 'inc_refunds', name: 'Refunds', type: 'income', icon: '↩️', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_refunds_purchase', name: 'Purchase Refund', type: 'income', parentId: 'inc_refunds', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_refunds_subscription', name: 'Subscription Refund', type: 'income', parentId: 'inc_refunds', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_refunds_other', name: 'Other Refund', type: 'income', parentId: 'inc_refunds', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },

  // Other Income
  { id: 'inc_other', name: 'Other', type: 'income', icon: '🧾', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'inc_other_general', name: 'Other Income', type: 'income', parentId: 'inc_other', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  
  // ================= LEGACY / FALLBACK MIGRATION =================
  { id: 'legacy_other_expense', name: 'Legacy Expenses', type: 'expense', icon: '📦', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 },
  { id: 'legacy_other_income', name: 'Legacy Income', type: 'income', icon: '📦', isDefault: true, isActive: true, createdAt: nowStr, updatedAt: nowTs, version: 1 }
];
