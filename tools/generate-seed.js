/**
 * generate-seed.js
 * ----------------
 * Single source of truth for the Fume restaurant menu.
 * Run with:  node tools/generate-seed.js
 *
 * Generates:
 *   apps-script/SeedData.gs   -> pasted into the Apps Script project (menu rows + settings)
 *   public/data/menu.json     -> offline / fallback data used by the static site
 *   data/fume-menu.csv        -> optional manual import into Google Sheets
 *
 * Menu data was extracted from the live Ring N Bring deployment
 * (restaurantId akRuD2EpTqXN0H6C47UK, menu "Fume Menu", currency USD).
 */

const MENU_NAME = 'Fume Menu';

// [section, category, name_en, name_ar, desc_en, price]
const ROWS = [
  // ---------------- Breakfast ----------------
  ['Breakfast', '.', 'Lebanese Breakfast', 'الفطور اللبناني', 'Apple or Chilled Fruit Juice (Apple, Pineapple, Exotic) | Foul Moudammas Plate | Lebanese Labneh Plate | Assorted Lebanese Cheese Plate | Fresh Mixed Vegetables, Pickles & Olives Plate | Arabic Bread | Lebanese Kunafa | Halawi Plate | Two Eggs: with your choice of (Awarma, Shakshouka, Sojouk) | Tea, Coffee or Hot Chocolate)', 24],
  ['Breakfast', '.', 'Continental Breakfast', 'الفطور الكونتيننتال', 'Apple or Chilled Fruit Juice (Apple, Pineapple, Exotic) | Freshly Baked: Croissant, Danish, Bread Rolls & Toast | Honey, Jam & Butter | Tea, Coffee or Chocolate', 22],
  ['Breakfast', '.', 'Cold Cuts Plate', 'طبق لحوم باردة مشكلة', 'Smoked Turkey, Beef Mortadella, Chicken Mortadella and Bresaola', 12],
  ['Breakfast', '.', 'Lebanese Cheese Plate', 'طبق أجبان لبنانية', '', 14],
  ['Breakfast', '.', 'International Cheese Plate', 'تشكيلة من الأجبان الأوروبية', 'Cheddar; Emmental; Goat Cheese & Kashkaval Served with bread basket (2 Pain-de-Mie; 2 Pita bread & 2 bread rolls).', 18],
  ['Breakfast', '.', '3 Eggs', '3 بيضات', '', 7],
  ['Breakfast', '.', 'Mini Manakish', 'مناقيش صغيرة', '', 7],
  ['Breakfast', '.', 'Foul Moudammas', 'فول مدمس', 'Served with vegetables plate; Pita bread and Olive oil', 7],
  ['Breakfast', '.', 'Pancake', 'بان كيك', '3 Pancakes; Served with fresh Fruits & Maple Syrup', 8],
  ['Breakfast', '.', 'Jam & Butter', 'مربى و زبدة', 'Jam (Apricot & Strawberry); Honey & 2 Butter; served with bread basket; 2 bread rolls; 2 Pain-de-Mie & 2 Pita bread.', 8],
  // ---------------- Starters ----------------
  ['Starters', '.', 'Dynamite Shrimp', 'داينمايت شريمبس', 'Scallions, Spicy Sauce', 15],
  ['Starters', '.', 'Truffle Parmesan Fries', 'ترافل بارميزون والبطاطا', '', 10],
  ['Starters', '.', 'Mexican Nachos', 'مكسيكان ناتشوز', 'Nachos Under Cheddar Cheese, Served With Jalapenos, Tomato Salsa, Guacamole & Sour Cream', 15],
  ['Starters', '.', 'French Fries', 'بطاطا مقلية', '', 7],
  ['Starters', '.', 'Lentil Soup', 'شوربة العدس', '', 7],
  // ---------------- Lebanese Corner ----------------
  ['Lebanese Corner', '.', 'Fattoush', 'فتوش', '', 7],
  ['Lebanese Corner', '.', 'Tabbouleh', 'تبولة', '', 7],
  ['Lebanese Corner', '.', 'Caesar Salad', 'سلطة التشيكن سيزر', 'Crisp Iceberg Lettuce With Golden Croutons & Parmesan Cheese Shavings, Served With Caesar Dressing', 10],
  ['Lebanese Corner', '.', 'Mixed Mouajanat', 'معجنات مشكلة', 'Sambousek, Kebbeh, Rakakat Cheese', 15],
  ['Lebanese Corner', '.', 'Hummus', 'حمص', '', 6],
  ['Lebanese Corner', '.', 'Moutabal', 'متبل', '', 6],
  ['Lebanese Corner', '.', 'Vine Leaves', 'ورق عنب', '', 7],
  ['Lebanese Corner', '.', 'Labneh Plate', 'صحن لبنة', 'Served with vegetables plate; Pita bread and Olive oil', 7],
  ['Lebanese Corner', '.', 'Hummus with Meat', 'حمص باللحم', '', 12],
  ['Lebanese Corner', '.', 'Spicy Potato', 'بطاطا حارة', '', 7],
  ['Lebanese Corner', '.', 'Makanek', 'مقانق', '', 10],
  ['Lebanese Corner', '.', 'Soujouk', 'سجق', '', 10],
  ['Lebanese Corner', '.', 'Earthquake Salad', 'سلطة إيرثكويك', 'Grilled Shrimps, Crunchy Leaves, Fresh Pomegranate Seeds, Mushrooms & Cherry Tomatoes, Served With Basil Mayo Dressing.', 18],
  // ---------------- Sandwiches ----------------
  ['Sandwiches', '.', 'Plaza Burger', 'برغر بلازا', 'Our homemade char-grilled beef to perfection, Cheddar cheese, grilled Tomato & sautéed mushrooms, served with our special dressing', 16],
  ['Sandwiches', '.', 'Club Sandwich', 'كلوب ساندويش', 'Grilled Chicken in Pain Demi, Fried Eggs, Turkey Bacon, Tomato & Lettuce', 16],
  ['Sandwiches', '.', 'NY Steak Sandwich', 'نيو يورك ستيك سندويش', 'Sautéed Beef With Bell Pepper, Fresh Mushrooms, Caramelized Onions & Cheddar Cheese', 19],
  ['Sandwiches', '.', 'Chicken Burger', 'برغر الدجاج', 'Charcoal grilled chicken breast coated with herbs & crispy lettuce & sundried tomatoes; topped with Parmesan & served with a spread of cocktail sauce', 15],
  ['Sandwiches', '.', 'Chicken Avocado', 'تشيكن افوكادو', 'Avocado, Baguette Brown, Rocca, Grilled Chicken Breast, Panko Sauce', 16],
  // ---------------- Pasta ----------------
  ['Pasta', '.', 'Chicken Alfredo', 'دجاج ألفريدو', 'Fettuccine With Chicken, Mushrooms, Creamy Sauce, Truffle Paste & Oil, Fresh Basil', 18],
  ['Pasta', '.', 'Spaghetti Bolognaise', 'سباغيتي بولونيز', 'Spaghetti With Tomato & Minced Meat Sauce', 16],
  ['Pasta', '.', 'Penne Arabiata', 'بيني أرابياتا', 'Penne Served With Spicy Tomato Sauce & Herbs', 14],
  // ---------------- Main Course ----------------
  ['Main Course', '.', 'Grilled Chicken Breast', 'صدر دجاج مشوي', '', 20],
  ['Main Course', '.', 'Australian Beef Tenderloin', 'بيف فيليه', 'Australian Char-grilled Beef Tenderloin Served With Mushroom Sauce', 28],
  ['Main Course', '.', 'Chicken Shawarma', 'شاورما دجاج', '', 12],
  ['Main Course', '.', 'Chicken Cordon Bleu', 'دجاج كوردون بلو', 'Turkey ham, cheese, Mashed potato, steamed veggie', 18],
  ['Main Course', '.', 'Grilled Salmon', 'سلمون مشوي', '', 30],
  ['Main Course', '.', 'Beef Shawarma', 'شاورما لحمة', '', 14],
  ['Main Course', 'Add-on', 'Add Extra Chicken', 'إضافة دجاج', '', 8],
  ['Main Course', 'Add-on', 'Add Extra Shrimp', 'إضافة روبيان', '', 10],
  // ---------------- Sides ----------------
  ['Sides', '.', 'Bread Basket', 'سلة خبز', '2 Bread rolls; 2 Pain-de-Mie; 2 Pita bread; 2 Toast & 2 butter Served with butter; Honey & Jam (Apricot & Strawberry).', 6],
  ['Sides', '.', 'Side Yogurt', 'لبن زبادي جانبي', '', 5],
  ['Sides', '.', 'Bakery Basket', 'سلة مخبوزات', '', 10],
  // ---------------- Sushi ----------------
  ['Sushi', 'Salads', 'Crazy Crab Salad', '', '', 15],
  ['Sushi', 'Salads', 'Crazy Salmon Salad', '', '', 22],
  ['Sushi', 'Salads', 'Salmon Tataki Salad', '', '', 22],
  ['Sushi', 'Salads', 'Tuna Tataki Salad', '', '', 22],
  ['Sushi', 'Hosomaki / 3 pieces', 'Avocado', '', '', 6],
  ['Sushi', 'Hosomaki / 3 pieces', 'Crab', '', '', 6],
  ['Sushi', 'Hosomaki / 3 pieces', 'Tuna', '', '', 8],
  ['Sushi', 'Hosomaki / 3 pieces', 'Salmon', '', '', 9],
  ['Sushi', 'Hosomaki / 3 pieces', 'Kappa', '', '', 5],
  ['Sushi', 'Hosomaki / 3 pieces', 'Shrimp', '', '', 8],
  ['Sushi', 'Hosomaki / 3 pieces', 'Unagi', '', '', 9],
  ['Sushi', 'Uramaki / 4 pieces', 'Ebico California', '', '', 6],
  ['Sushi', 'Uramaki / 4 pieces', 'Tanoki', '', '', 6],
  ['Sushi', 'Uramaki / 4 pieces', 'Naked Spicy Volcano', '', '', 12],
  ['Sushi', 'Uramaki / 4 pieces', 'Crazy Salmon', '', '', 10],
  ['Sushi', 'Uramaki / 4 pieces', 'Black Tail', '', '', 10],
  ['Sushi', 'Uramaki / 4 pieces', 'Spicy Volcano', '', '', 14],
  ['Sushi', 'Uramaki / 4 pieces', 'Sesame California', '', '', 8],
  ['Sushi', 'Uramaki / 4 pieces', 'Crispy Crazy', '', '', 7],
  ['Sushi', 'Uramaki / 4 pieces', 'Chili Shrimp', '', '', 8],
  ['Sushi', 'Uramaki / 4 pieces', 'Crazy Wrap', '', '', 6],
  ['Sushi', 'Uramaki / 4 pieces', 'Salmon Crispy', '', '', 12],
  ['Sushi', 'Uramaki / 4 pieces', 'Cheesy Salmon', '', '', 12],
  ['Sushi', 'Uramaki Signatures / 8 pieces', 'Rainbow', '', '', 17],
  ['Sushi', 'Uramaki Signatures / 8 pieces', 'Sunset', '', '', 13],
  ['Sushi', 'Uramaki Signatures / 8 pieces', 'Dragon', '', '', 13],
  ['Sushi', 'Uramaki Signatures / 8 pieces', 'Caterpillar', '', '', 13],
  ['Sushi', 'Uramaki Signatures / 8 pieces', 'Shrimp Lover', '', '', 13],
  ['Sushi', 'Temaki', 'California', '', '', 7],
  ['Sushi', 'Temaki', 'Salmon', '', '', 8],
  ['Sushi', 'Temaki', 'Norwegian', '', '', 10],
  ['Sushi', 'Temaki', 'Tuna', '', '', 8],
  ['Sushi', 'Sashimi / 3 pieces', 'Crab', '', '', 6],
  ['Sushi', 'Sashimi / 3 pieces', 'Salmon', '', '', 12],
  ['Sushi', 'Sashimi / 3 pieces', 'Shrimp 30 g', '', '', 6],
  ['Sushi', 'Sashimi / 3 pieces', 'Scalopp', '', '', 10],
  ['Sushi', 'Sashimi / 3 pieces', 'Hamachi', '', '', 10],
  ['Sushi', 'Sashimi / 3 pieces', 'Tuna', '', '', 10],
  ['Sushi', 'Sashimi / 3 pieces', 'Unagi', '', '', 10],
  ['Sushi', 'Sashimi / 3 pieces', 'White Fish', '', '', 20],
  ['Sushi', 'Nigiri / 2 pieces', 'Shrimp', '', '', 5],
  ['Sushi', 'Nigiri / 2 pieces', 'White Fish', '', '', 12],
  ['Sushi', 'Nigiri / 2 pieces', 'Unagi', '', '', 7],
  ['Sushi', 'Nigiri / 2 pieces', 'Crab', '', '', 4],
  ['Sushi', 'Nigiri / 2 pieces', 'Salmon', '', '', 8],
  ['Sushi', 'Nigiri / 2 pieces', 'Tuna', '', '', 8],
  ['Sushi', 'Futo Maki / 5 pieces', 'Orange Blossom', '', '', 9],
  ['Sushi', 'Sets', 'Sashimi Mix - 9 Pieces', '', '', 30],
  ['Sushi', 'Sets', 'Plaza Classic Sushi - 14 Pieces', '', '', 25],
  ['Sushi', 'Sets', 'Plaza Premium Sushi - 25 Pieces', '', '', 45],
  ['Sushi', 'Sets', 'Crab Lovers - 17 Pieces', '', '', 25],
  ['Sushi', 'Sets', 'Plaza Royal Mix - 30 Pieces', '', '', 82],
  ['Sushi', 'Sets', 'Salmon Platter Set - 16 Pieces', '', '', 38],
  // ---------------- Dessert ----------------
  ['Dessert', '.', 'Fresh Fruit Cuts Plate', 'فاكهة طازجة مقطعة', '', 15],
  ['Dessert', '.', 'Chocolate Fondante', 'فوندان الشوكولاتة', 'Chocolate fondante with Vanilla Ice Cream', 10],
  ['Dessert', '.', 'Raspberry Cheesecake', 'تشيز كيك بالتوت الأحمر', 'Streusel biscuit topped with Philadelphia cream cheese & red berries compote', 10],
  ['Dessert', '.', 'Ice Cream & Sorbet', 'بوظة وسوربيه', 'Your choice of 3 scoops: Chocolate, Vanilla, Dulce de leche, Strawberry, Raspberry, Lemon, Mango & Mandarin', 3],
  ['Dessert', '.', 'Tiramisu', 'تيراميسو', 'Light and creamy coffee-flavored dessert with layers of mascarpone and cocoa.', 10],
  ['Dessert', '.', 'Cheese Kunafa', 'كنافة بالجبنة', '', 10]
];

const RESTAURANT = {
  name: 'fume bar',
  tagline_en: 'Restaurant · Lounge · Sushi',
  tagline_ar: 'مطعم · لاونج · سوشي',
  currency: 'USD',
  phone: '+961 1 791 000',
  address: 'Lancaster Plaza, General de Gaulle Avenue, Raouche — Beirut, Lebanon',
  instagram: 'https://www.instagram.com/lancasterplazabeirut/',
  facebook: 'https://www.facebook.com/LancasterPlazabeirut/',
  logoUrl: 'img/logo.jpg',
  adminPassword: '',
};

const ITEM_HEADER = ['id', 'sort', 'menu', 'section', 'section_ar', 'category', 'category_ar', 'name_en', 'name_ar', 'desc_en', 'price', 'price_small', 'price_medium', 'price_large', 'calories', 'available'];

// Arabic display names for sections and sub-categories (shown in AR / RTL mode)
const SECTIONS_AR = {
  'Breakfast': 'الفطور',
  'Starters': 'المقبلات',
  'Lebanese Corner': 'الزاوية اللبنانية',
  'Sandwiches': 'الساندويتشات',
  'Pasta': 'المعكرونة',
  'Main Course': 'الأطباق الرئيسية',
  'Sides': 'الأطباق الجانبية',
  'Sushi': 'سوشي',
  'Dessert': 'الحلويات',
};

const CATEGORIES_AR = {
  'Salads': 'سلطات',
  'Hosomaki / 3 pieces': 'هوسوماكي / 3 قطع',
  'Uramaki / 4 pieces': 'أوراماكي / 4 قطع',
  'Uramaki Signatures / 8 pieces': 'أوراماكي سيناتشر / 8 قطع',
  'Temaki': 'تيماكي',
  'Sashimi / 3 pieces': 'ساشيمي / 3 قطع',
  'Nigiri / 2 pieces': 'نيغيري / قطعتان',
  'Futo Maki / 5 pieces': 'فوتو ماكي / 5 قطع',
  'Sets': 'تشكيلات',
  'Add-on': 'إضافات',
};

function buildRows() {
  return ROWS.map((r, i) => {
    const section = r[0].trim();
    const category = r[1].trim();
    return {
      id: 'i' + String(i + 1).padStart(3, '0'),
      sort: i + 1,
      menu: MENU_NAME,
      section: section,
      section_ar: SECTIONS_AR[section] || '',
      category: category,
      category_ar: (category && category !== '.') ? (CATEGORIES_AR[category] || '') : '',
      name_en: r[2].trim(),
      name_ar: (r[3] || '').trim(),
      desc_en: (r[4] || '').trim(),
      price: r[5],
      price_small: '',
      price_medium: '',
      price_large: '',
      calories: '',
      available: true,
    };
  });
}

/** Group flat rows -> sections -> categories (same logic as Code.gs) */
function buildMenuJson() {
  const rows = buildRows();
  const sections = [];
  const sectionIndex = new Map();
  for (const row of rows) {
    if (!sectionIndex.has(row.section)) {
      sectionIndex.set(row.section, {
        name: row.section,
        nameAr: row.section_ar || '',
        items: [],
        categories: [],
      });
      sections.push(sectionIndex.get(row.section));
    }
    const section = sectionIndex.get(row.section);
    const item = {
      id: row.id,
      nameEn: row.name_en,
      nameAr: row.name_ar,
      desc: row.desc_en,
      price: Number(row.price) || 0,
      priceSmall: row.price_small === '' ? null : Number(row.price_small),
      priceMedium: row.price_medium === '' ? null : Number(row.price_medium),
      priceLarge: row.price_large === '' ? null : Number(row.price_large),
      calories: row.calories === '' ? null : Number(row.calories),
    };
    if (!row.category || row.category === '.') {
      section.items.push(item);
    } else {
      let cat = section.categories.find((c) => c.name === row.category);
      if (!cat) {
        cat = { name: row.category, nameAr: row.category_ar || '', items: [] };
        section.categories.push(cat);
      }
      cat.items.push(item);
    }
  }
  return {
    restaurant: {
      name: RESTAURANT.name,
      tagline: RESTAURANT.tagline_en,
      taglineAr: RESTAURANT.tagline_ar,
      currency: RESTAURANT.currency,
      phone: RESTAURANT.phone,
      address: RESTAURANT.address,
      instagram: RESTAURANT.instagram,
      facebook: RESTAURANT.facebook,
      logoUrl: RESTAURANT.logoUrl,
    },
    menu: { title: MENU_NAME, sections: sections },
  };
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return '"' + s.replace(/"/g, '""') + '"';
}

function buildCsv() {
  const lines = [ITEM_HEADER.join(',')];
  for (const row of buildRows()) {
    lines.push(ITEM_HEADER.map((k) => csvEscape(row[k])).join(','));
  }
  return lines.join('\n') + '\n';
}

function buildSeedGs() {
  const rows = buildRows();
  const rowsLit = rows
    .map((r) =>
      '  [' + [r.id, r.sort, r.menu, r.section, r.category, r.name_en, r.name_ar, r.desc_en, r.price, r.available, r.section_ar, r.category_ar]
        .map((v) => (typeof v === 'string' ? JSON.stringify(v) : v)).join(', ') + ']'
    )
    .join(',\n');
  const restLit = Object.entries(RESTAURANT)
    .map(([k, v]) => '  ' + k + ': ' + JSON.stringify(v))
    .join(',\n');
  return `/**
 * SeedData.gs
 * -----------
 * Auto-generated by tools/generate-seed.js — do not edit by hand.
 * Regenerate: node tools/generate-seed.js
 *
 * SEED_ROWS:       flat menu rows [id, sort, menu, section, category, name_en, name_ar, desc_en, price, available, section_ar, category_ar]
 * SEED_MENUS:      menu names that appear in SEED_ROWS
 * SEED_RESTAURANT: default restaurant / contact settings
 */

var SEED_MENUS = ${JSON.stringify([MENU_NAME])};

var SEED_RESTAURANT = {
${restLit}
};

var SEED_ROWS = [
${rowsLit}
];
`;
}

// ---------- write outputs ----------
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const json = buildMenuJson();
const itemCount = json.menu.sections.reduce(
  (n, s) => n + s.items.length + s.categories.reduce((m, c) => m + c.items.length, 0), 0);

fs.mkdirSync(path.join(root, 'apps-script'), { recursive: true });
fs.writeFileSync(path.join(root, 'apps-script', 'SeedData.gs'), buildSeedGs(), 'utf8');
fs.mkdirSync(path.join(root, 'public', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'data', 'menu.json'), JSON.stringify(json, null, 2), 'utf8');
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'fume-menu.csv'), buildCsv(), 'utf8');

console.log('OK  sections=%d  items=%d', json.menu.sections.length, itemCount);
json.menu.sections.forEach((s) => {
  const total = s.items.length + s.categories.reduce((m, c) => m + c.items.length, 0);
  console.log('   - ' + s.name.padEnd(28) + ' ' + total + ' items' + (s.categories.length ? '  (cats: ' + s.categories.map((c) => c.name).join(' | ') + ')' : ''));
});

