// Business logic constants for LiveMart Backend

export const ABSOLUTE_WHOLESALE_MINIMUM = 10; // Platform rule: never less than 10 units
export const DEFAULT_WHOLESALE_MINIMUM = 25;  // Suggested default for wholesalers
export const DEFAULT_REORDER_LEVEL = 10;      // Default low-stock alert threshold for retailers

// Category-specific minimums (can be expanded later)
export const CATEGORY_RULES = {
    'Electronics': { wholesale_minimum: 10, retail_max: 5 },
    'Groceries': { wholesale_minimum: 100, retail_max: 20 },
    'Clothing': { wholesale_minimum: 50, retail_max: 10 },
    'Furniture': { wholesale_minimum: 5, retail_max: 2 },
    'Default': { wholesale_minimum: 25, retail_max: 10 }
};

// Order types
export const ORDER_TYPES = {
    RETAIL: 'retail',
    WHOLESALE: 'wholesale'
};

// User roles
export const USER_ROLES = {
    CUSTOMER: 'customer',
    RETAILER: 'retailer',
    WHOLESALER: 'wholesaler'
};
