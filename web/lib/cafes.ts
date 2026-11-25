import { HOURS, type WeekHours } from "./hours";

// The campus cafés, shown on the Cafe tab. They aren't on the menu source and don't post a daily menu, so their menus are
// transcribed here from the cafés' own sites; update this file when they change. Hours are in hours.ts.
// Euphoria's site lists no prices. Hamilton posts no menu for the campus FoJo cafés (fojobeans.com's menu PDF is for
// the store in the village of Hamilton), so they show hours only until someone transcribes the menu boards.

export type CafeItem = {
  name: string;
  /** Flavors, sizes or what's in it. */
  detail?: string;
};

export type Cafe = {
  slug: string;
  name: string;
  where: string;
  hours: WeekHours;
  /** One line under the name. */
  blurb: string;
  /** Category -> items. Absent: menu not posted yet. */
  menu?: Record<string, CafeItem[]>;
  /** Fine print under the menu. */
  note?: string;
  site: string;
};

const HOT_ICED = "Hot (12, 16 or 20 oz) or iced (16 or 24 oz)";
const MEDIUM_LARGE = "Medium 16 oz or large 24 oz";

const EUPHORIA_MENU: Record<string, CafeItem[]> = {
  Breakfast: [
    { name: "New York Bagel", detail: "Plain, Everything, Asiago, Cheddar Jalapeño, Sesame or French Toast. Add butter, cream cheese or bacon." },
    { name: "Breakfast Sandwich", detail: "Seasoned eggs and cheese on any bagel, with bacon or sausage. Sauce: chipotle, ketchup or hot sauce." },
  ],
  Lunch: [
    { name: "Daily Lunch Special", detail: "A sandwich, wrap or salad that changes daily, weekdays 11:30 AM–3 PM. Comes with a side: Lay's chips, an apple, baby carrots or white cheddar puffs. Gluten free available." },
    { name: "To-Go Cup", detail: "The day's lunch special or salad ingredients in a cup, for a quick meal." },
    { name: "Mac & Cheese", detail: "Homemade; gluten free available. Add chipotle, ketchup, hot sauce, BBQ sauce or bacon." },
    { name: "Hummus", detail: "Made in house, with tortilla chips, baby carrots or pretzel chips." },
  ],
  "Baked Daily": [
    { name: "Muffins", detail: "Rotating: Blueberry, Chocolate Chip, Cinnamon Crumble, Pistachio, Double Chocolate, Lemon Chia." },
    { name: "Cookies", detail: "Regular or gluten free." },
    { name: "Euphoria Bar", detail: "Homemade granola bar." },
    { name: "Power Bites", detail: "Peanut Butter (oats, peanut butter, flaxseed, honey, cacao chips) or Almond Chia (oats, almond butter, chia, plant protein, honey, almonds, dried cherries)." },
  ],
  Coffee: [
    { name: "Coffee", detail: `Medium or dark roast. ${HOT_ICED}.` },
    { name: "Espresso", detail: "Double shot, cortado, Americano or cappuccino." },
    { name: "Latte", detail: `${HOT_ICED}; the small hot one is a flat white.` },
    { name: "Chai Latte", detail: `${HOT_ICED}.` },
    { name: "Frappe", detail: `Chocolate, Vanilla, Pistachio, Chai or Matcha, made with iced coffee or milk. ${MEDIUM_LARGE}.` },
    { name: "Add-ons", detail: "Flavor shot (vanilla, caramel, hazelnut, honey, maple, toasted marshmallow, toffee crunch, white chocolate, sugar-free vanilla or caramel), caramel or mocha sauce, extra espresso shot, oat or almond milk." },
  ],
  Smoothies: [
    { name: "Strawberry", detail: "Just strawberries." },
    { name: "Tropical Oasis", detail: "Mango with orange juice." },
    { name: "Hamilton", detail: "Acai with blueberry, raspberry, strawberry and blackberry." },
    { name: "Coco Loco", detail: "Pineapple and coconut." },
    { name: "Four Berry Fusion", detail: "Raspberry, blueberry, blackberry and strawberry." },
    { name: "Build Your Own", detail: "Add up to three: whey or plant protein, peanut butter, spinach, granola, almonds, chia, flax or an energy shot." },
  ],
  "Bubble Tea & More": [
    { name: "Bubble Tea", detail: `Black Milk Tea, Matcha Green Tea, Taro, Thai Tea or Guava (seasonal); traditional, blended or hot. ${MEDIUM_LARGE}. Popping boba or tapioca.` },
    { name: "Lotus Energy", detail: `Four Berry, Acai, Mango, Pineapple or Strawberry with natural-caffeine Lotus and seltzer. ${MEDIUM_LARGE}. Popping boba, tapioca or an extra Lotus shot.` },
    { name: "Hot Chocolate", detail: "Small 12, medium 16 or large 20 oz." },
    { name: "London Fog", detail: `Earl Grey with steamed milk and vanilla. ${HOT_ICED}.` },
    { name: "Tea", detail: "Earl Grey Cream, African Nectar, Organic Breakfast, Organic Green Dragon, Marrakesh Mint or Chamomile Citrus." },
  ],
};

const FOJO_BLURB = "Hand-crafted coffee drinks, plus paninis, bagels, soups, sandwiches and sweets.";

export const CAFES: Cafe[] = [
  {
    slug: "euphoria",
    name: "Euphoria",
    where: "Sadove Student Center, first floor",
    hours: HOURS.euphoria,
    blurb: "Coffee, smoothies and bubble tea, with made-to-order breakfast and lunch.",
    menu: EUPHORIA_MENU,
    note: "Smoothies are made with banana and yogurt; choose whole, skim, almond or oat milk, or orange juice. Small 12, medium 16 or large 22 oz. Ask at the counter for prices and the day's specials.",
    site: "https://euphoriacoffeecny.com/",
  },
  {
    slug: "fojo-north",
    name: "FoJo North",
    where: "Taylor Science Center atrium",
    hours: HOURS.fojoNorth,
    blurb: FOJO_BLURB,
    site: "https://fojobeans.com/",
  },
  {
    slug: "fojo-south",
    name: "FoJo South",
    where: "McEwen Hall, ground floor",
    hours: HOURS.fojoSouth,
    blurb: FOJO_BLURB,
    site: "https://fojobeans.com/",
  },
];
