/**
 * Food intelligence, offline engine.
 *
 * This is not a stub. When no AI key is configured the app still has to do something
 * genuinely useful with "what can I make with this", so this module carries a real
 * ingredient vocabulary, a real substitution table and real recipes with real steps.
 *
 * It cannot see the photo — that is stated plainly in the UI — but it can reason
 * about what the user typed or listed, honour an appliance constraint, respect a
 * budget, and adapt when something is missing.
 */

import type { Difficulty, Recipe, Step } from '../schema'
import { sameIngredient } from '../utils'

export type Cat = 'protein' | 'veg' | 'starch' | 'dairy' | 'fat' | 'spice' | 'fruit' | 'sauce' | 'other'

export interface PantryItem {
  name: string
  cat: Cat
  aliases: string[]
  /** rough cost in ZAR for a typical pack — estimates only, clearly labelled as such */
  cost?: number
  staple?: boolean
}

export const PANTRY: PantryItem[] = [
  // protein
  { name: 'eggs', cat: 'protein', aliases: ['egg', 'eier'], cost: 45 },
  { name: 'chicken', cat: 'protein', aliases: ['chicken breast', 'chicken pieces', 'chicken thighs', 'hoender', 'drumsticks'], cost: 95 },
  { name: 'chicken fillets', cat: 'protein', aliases: ['chicken fillet', 'chicken breasts'], cost: 110 },
  { name: 'beef mince', cat: 'protein', aliases: ['mince', 'ground beef', 'mielie'], cost: 95 },
  { name: 'steak', cat: 'protein', aliases: ['rump', 'sirloin', 'beef steak'], cost: 130 },
  { name: 'boerewors', cat: 'protein', aliases: ['wors', 'sausage', 'sausages'], cost: 85 },
  { name: 'russians', cat: 'protein', aliases: ['russian sausages'], cost: 60 },
  { name: 'tinned tuna', cat: 'protein', aliases: ['tuna', 'tinned fish'], cost: 30 },
  { name: 'tinned pilchards', cat: 'protein', aliases: ['pilchards', 'sardines', 'tinned sardines'], cost: 25 },
  { name: 'fish', cat: 'protein', aliases: ['hake', 'fish fillets', 'frozen fish'], cost: 70 },
  { name: 'bacon', cat: 'protein', aliases: ['streaky bacon', 'rashers'], cost: 55 },
  { name: 'polony', cat: 'protein', aliases: ['viennas', 'cold meat', 'ham'], cost: 35 },
  { name: 'lentils', cat: 'protein', aliases: ['lentil'], cost: 30, staple: true },
  { name: 'kidney beans', cat: 'protein', aliases: ['beans', 'baked beans', 'butter beans', 'black beans', 'tinned beans'], cost: 22 },

  // starch
  { name: 'bread', cat: 'starch', aliases: ['brown bread', 'white bread', 'loaf', 'brood'], cost: 20 },
  { name: 'rice', cat: 'starch', aliases: ['white rice', 'basmati', 'long grain', 'rys'], cost: 35, staple: true },
  { name: 'pasta', cat: 'starch', aliases: ['spaghetti', 'macaroni', 'penne', 'noodles', 'pasta shells'], cost: 25, staple: true },
  { name: 'maize meal', cat: 'starch', aliases: ['mielie meal', 'pap', 'mealie meal', 'super maize'], cost: 40, staple: true },
  { name: 'samp', cat: 'starch', aliases: ['samp and beans', 'umngqusho'], cost: 30 },
  { name: 'potatoes', cat: 'starch', aliases: ['potato', 'aartappels', 'spuds'], cost: 40 },
  { name: 'sweet potatoes', cat: 'starch', aliases: ['sweet potato', 'patat'], cost: 35 },
  { name: 'flour', cat: 'starch', aliases: ['cake flour', 'self-raising flour', 'meel'], cost: 35, staple: true },
  { name: 'oats', cat: 'starch', aliases: ['oatmeal', 'pronutro'], cost: 45 },
  { name: 'tortillas', cat: 'starch', aliases: ['wraps', 'flatbreads', 'roti'], cost: 40 },
  { name: 'instant noodles', cat: 'starch', aliases: ['two minute noodles', 'ramen'], cost: 12 },
  { name: 'couscous', cat: 'starch', aliases: ['quinoa'], cost: 40 },

  // veg
  { name: 'onion', cat: 'veg', aliases: ['onions', 'ui'], cost: 20 },
  { name: 'tomatoes', cat: 'veg', aliases: ['tomato', 'tamatie'], cost: 25 },
  { name: 'tinned tomatoes', cat: 'veg', aliases: ['chopped tomatoes', 'tomato puree', 'tomato paste', 'tinned tomato'], cost: 18 },
  { name: 'garlic', cat: 'veg', aliases: ['garlic cloves', 'knoffel'], cost: 15 },
  { name: 'ginger', cat: 'veg', aliases: ['fresh ginger'], cost: 15 },
  { name: 'carrots', cat: 'veg', aliases: ['carrot', 'wortels'], cost: 20 },
  { name: 'spinach', cat: 'veg', aliases: ['baby spinach', 'morogo', 'imifino', 'swiss chard'], cost: 25 },
  { name: 'cabbage', cat: 'veg', aliases: ['kool'], cost: 18 },
  { name: 'butternut', cat: 'veg', aliases: ['butternut squash', 'pumpkin', 'boer pumpkin'], cost: 30 },
  { name: 'green beans', cat: 'veg', aliases: ['beans fresh', 'snap peas'], cost: 25 },
  { name: 'peas', cat: 'veg', aliases: ['frozen peas', 'petit pois'], cost: 25 },
  { name: 'mixed vegetables', cat: 'veg', aliases: ['frozen veg', 'mixed veg'], cost: 30 },
  { name: 'green pepper', cat: 'veg', aliases: ['peppers', 'bell pepper', 'red pepper', 'yellow pepper'], cost: 20 },
  { name: 'chilli', cat: 'veg', aliases: ['chillies', 'chili', 'chilli flakes', 'dried chilli'], cost: 12 },
  { name: 'mushrooms', cat: 'veg', aliases: ['mushroom', 'sampioene'], cost: 30 },
  { name: 'courgette', cat: 'veg', aliases: ['zucchini', 'baby marrow'], cost: 25 },
  { name: 'broccoli', cat: 'veg', aliases: ['cauliflower'], cost: 35 },
  { name: 'lettuce', cat: 'veg', aliases: ['salad leaves', 'rocket', 'cos'], cost: 22 },
  { name: 'cucumber', cat: 'veg', aliases: ['komkommer'], cost: 15 },
  { name: 'corn', cat: 'veg', aliases: ['mielies', 'sweetcorn', 'sweet corn', 'mealie'], cost: 20 },
  { name: 'avocado', cat: 'veg', aliases: ['avo', 'avocados'], cost: 25 },
  { name: 'spring onion', cat: 'veg', aliases: ['scallions', 'spring onions'], cost: 15 },

  // dairy
  { name: 'milk', cat: 'dairy', aliases: ['melk', 'long life milk', 'fresh milk'], cost: 22 },
  { name: 'cheese', cat: 'dairy', aliases: ['gouda', 'cheddar', 'kaas', 'cheese slices'], cost: 55 },
  { name: 'butter', cat: 'dairy', aliases: ['margarine', 'botter', 'marge'], cost: 45 },
  { name: 'yoghurt', cat: 'dairy', aliases: ['yogurt', 'double cream yoghurt'], cost: 30 },
  { name: 'cream', cat: 'dairy', aliases: ['fresh cream', 'cooking cream', 'evaporated milk', 'ideal milk'], cost: 30 },

  // fat
  { name: 'cooking oil', cat: 'fat', aliases: ['oil', 'sunflower oil', 'olive oil', 'canola'], cost: 45, staple: true },

  // spice / seasoning
  { name: 'salt', cat: 'spice', aliases: ['sout', 'sea salt'], cost: 12, staple: true },
  { name: 'black pepper', cat: 'spice', aliases: ['pepper', 'ground pepper'], cost: 25, staple: true },
  { name: 'curry powder', cat: 'spice', aliases: ['masala', 'rajah', 'curry masala'], cost: 20, staple: true },
  { name: 'paprika', cat: 'spice', aliases: ['smoked paprika'], cost: 25, staple: true },
  { name: 'stock cubes', cat: 'spice', aliases: ['stock', 'oxo', 'beef stock', 'chicken stock', 'knorrox'], cost: 20, staple: true },
  { name: 'sugar', cat: 'spice', aliases: ['brown sugar', 'white sugar', 'suiker'], cost: 30, staple: true },
  { name: 'mixed herbs', cat: 'spice', aliases: ['oregano', 'thyme', 'italian herbs', 'herbs'], cost: 22, staple: true },
  { name: 'bay leaves', cat: 'spice', aliases: ['bay leaf'], cost: 15 },
  { name: 'cinnamon', cat: 'spice', aliases: ['mixed spice', 'nutmeg'], cost: 20, staple: true },
  { name: 'baking powder', cat: 'spice', aliases: ['bicarbonate of soda', 'bicarb', 'baking soda'], cost: 18, staple: true },
  { name: 'yeast', cat: 'spice', aliases: ['instant yeast'], cost: 15 },
  { name: 'vanilla essence', cat: 'spice', aliases: ['vanilla extract', 'vanilla'], cost: 20, staple: true },

  // sauce / condiment
  { name: 'tomato sauce', cat: 'sauce', aliases: ['ketchup', 'all gold'], cost: 30 },
  { name: 'soy sauce', cat: 'sauce', aliases: ['soya sauce'], cost: 25, staple: true },
  { name: 'mayonnaise', cat: 'sauce', aliases: ['mayo', 'miracle whip'], cost: 35 },
  { name: 'chutney', cat: 'sauce', aliases: ['mrs balls', 'peach chutney'], cost: 35 },
  { name: 'hot sauce', cat: 'sauce', aliases: ['peri peri', 'tabasco', 'chilli sauce'], cost: 30 },
  { name: 'peanut butter', cat: 'sauce', aliases: ['peanut', 'groundnut'], cost: 45 },
  { name: 'honey', cat: 'sauce', aliases: ['syrup', 'golden syrup'], cost: 45 },
  { name: 'jam', cat: 'sauce', aliases: ['conserve', 'marmalade'], cost: 35 },

  // fruit
  { name: 'banana', cat: 'fruit', aliases: ['bananas', 'piesang'], cost: 25 },
  { name: 'apple', cat: 'fruit', aliases: ['apples', 'appel'], cost: 30 },
  { name: 'orange', cat: 'fruit', aliases: ['oranges', 'naartjie', 'naartjies'], cost: 25 },
  { name: 'lemon', cat: 'fruit', aliases: ['lemons', 'suurlemoen'], cost: 15 },
  { name: 'strawberries', cat: 'fruit', aliases: ['berries', 'mixed berries'], cost: 45 },
  { name: 'mango', cat: 'fruit', aliases: ['mangoes'], cost: 30 },
]

export const EQUIPMENT = [
  { name: 'stovetop', aliases: ['stove', 'hotplate', 'hot plates', 'gas stove', 'plate', 'plates'] },
  { name: 'oven', aliases: ['bake', 'baking oven', 'grill'] },
  { name: 'microwave', aliases: ['micro', 'microwaves'] },
  { name: 'kettle', aliases: ['electric kettle'] },
  { name: 'toaster', aliases: ['toaster'] },
  { name: 'air fryer', aliases: ['airfryer', 'air-fryer'] },
  { name: 'braai', aliases: ['barbecue', 'bbq', 'weber', 'fire'] },
  { name: 'slow cooker', aliases: ['crockpot', 'crock pot'] },
  { name: 'pot', aliases: ['pots', 'saucepan', 'sauce pan', 'casserole'] },
  { name: 'frying pan', aliases: ['pan', 'pans', 'skillet', 'panne'] },
  { name: 'baking tray', aliases: ['oven tray', 'tray', 'baking sheet'] },
  { name: 'blender', aliases: ['liquidiser', 'nutribullet'] },
  { name: 'toasted sandwich maker', aliases: ['sandwich maker', 'snackwich'] },
  { name: 'pressure cooker', aliases: ['instapot', 'instant pot'] },
  { name: 'no cooking', aliases: ['nothing to cook with', 'no stove', 'no kitchen', 'no electricity', 'loadshedding', 'load shedding'] },
]

/** Find canonical pantry items mentioned in free text. */
export function parseIngredients(text: string): string[] {
  if (!text) return []
  const lower = ` ${text.toLowerCase()} `
  const found = new Set<string>()
  for (const item of PANTRY) {
    const needles = [item.name, ...item.aliases]
    for (const n of needles) {
      // word-boundary-ish match so "oil" doesn't fire on "boiled"
      const re = new RegExp(`(^|[^\\p{L}])${escapeRe(n)}(s|es)?([^\\p{L}]|$)`, 'iu')
      if (re.test(lower)) {
        found.add(item.name)
        break
      }
    }
  }
  return [...found]
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseEquipment(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `
  const found = new Set<string>()
  for (const eq of EQUIPMENT) {
    for (const n of [eq.name, ...eq.aliases]) {
      const re = new RegExp(`(^|[^\\p{L}])${escapeRe(n)}(s)?([^\\p{L}]|$)`, 'iu')
      if (re.test(lower)) {
        found.add(eq.name)
        break
      }
    }
  }
  if (found.size) found.add('stovetop')
  return [...found]
}

export function parseBudget(text: string): number | undefined {
  const m =
    text.match(/\br\s?(\d{2,5})\b/i) ||
    text.match(/\b(\d{2,5})\s?(?:rand|zar|bucks)\b/i) ||
    text.match(/\bbudget\s?(?:of|is)?\s?(\d{2,5})\b/i)
  return m ? Number(m[1]) : undefined
}

/** "I don't have cheese", "no oven", "without tomatoes" */
export function parseNegations(text: string): string[] {
  const out = new Set<string>()
  const patterns = [
    /\b(?:i\s+)?(?:don'?t|do not|dont)\s+have\s+(?:any\s+)?([^.,;!?]+)/gi,
    /\bno\s+([a-z][a-z\s]{2,28}?)(?=[.,;!?]|$|\s+(?:and|but|so)\b)/gi,
    /\bwithout\s+([^.,;!?]+)/gi,
    /\b(?:i'?m|i am)\s+out of\s+([^.,;!?]+)/gi,
    /\b(?:ran out of|finished the)\s+([^.,;!?]+)/gi,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const chunk = m[1]
      for (const ing of parseIngredients(chunk)) out.add(ing)
      const raw = chunk.trim().toLowerCase()
      if (/^oven$|oven/.test(raw)) out.add('oven')
      if (/stove|hotplate/.test(raw)) out.add('stovetop')
      if (/microwave/.test(raw)) out.add('microwave')
      if (/electricity|power/.test(raw)) out.add('electricity')
    }
  }
  return [...out]
}

/* ------------------------------------------------------------------ substitutions */

export const SUBSTITUTIONS: { missing: string; use: string; note: string }[] = [
  { missing: 'butter', use: 'cooking oil or margarine', note: 'Same quantity. Oil makes pastry heavier, fine for frying and baking.' },
  { missing: 'milk', use: 'long-life milk, or 3 tbsp milk powder in 250 ml water', note: 'For baking, water plus a spoon of butter works too.' },
  { missing: 'cream', use: 'evaporated milk, or full-cream milk with a knob of butter', note: 'Won’t whip, but it is perfect in sauces and curries.' },
  { missing: 'cheese', use: 'nothing needed — or a spoon of mayonnaise for creaminess', note: 'Most dishes are fine without it. Use more seasoning instead.' },
  { missing: 'onion', use: 'spring onion, leek, or 1 tsp onion powder', note: 'Or a pinch of sugar with the tomatoes to replace the sweetness.' },
  { missing: 'garlic', use: '½ tsp garlic powder per clove, or skip it', note: 'Add with the onions so it blooms in the oil.' },
  { missing: 'tomatoes', use: 'tinned tomatoes, tomato sauce, or a spoon of tomato paste plus water', note: 'One tin replaces about four fresh tomatoes.' },
  { missing: 'lemon', use: '1 tbsp vinegar, or a pinch of citric acid', note: 'Use half the quantity — vinegar is sharper.' },
  { missing: 'yoghurt', use: 'sour cream, or milk with a few drops of lemon juice left to stand 5 minutes', note: 'Add off the heat so it does not split.' },
  { missing: 'chicken', use: 'tinned tuna, pilchards, lentils, or tinned beans', note: 'Add tinned fish at the very end so it stays in one piece.' },
  { missing: 'beef mince', use: 'lentils or soya mince, rehydrated', note: 'Use the same seasoning and a little extra oil.' },
  { missing: 'rice', use: 'pasta, pap or couscous', note: 'Cook separately, then fold through the sauce.' },
  { missing: 'pasta', use: 'rice, noodles, or pap', note: 'Keep the same sauce — just adjust the cooking time.' },
  { missing: 'bread', use: 'tortillas, rolls, or pap', note: 'For toasties, a dry pan works instead of a machine.' },
  { missing: 'eggs', use: 'for binding: 1 tbsp ground flax + 3 tbsp water, rested 5 minutes', note: 'There is no substitute for eggs in an omelette or scramble.' },
  { missing: 'flour', use: 'cake flour and self-raising flour interchangeably, or blend oats fine', note: 'Add 1 tsp baking powder per cup if using cake flour for self-raising.' },
  { missing: 'chilli', use: '1 tsp paprika plus a pinch of black pepper, or hot sauce at the table', note: 'Gives warmth without the heat.' },
  { missing: 'soy sauce', use: '1 tbsp Worcestershire sauce, or a stock cube dissolved in water', note: 'Both are salty, so taste before adding salt.' },
  { missing: 'curry powder', use: '1 tsp turmeric + 1 tsp ground cumin + ½ tsp paprika', note: 'Closer to a Durban masala than a mild Cape curry.' },
  { missing: 'stock cubes', use: 'the water from boiling vegetables, plus extra salt', note: 'Or a splash of soy sauce in dark dishes.' },
  { missing: 'cooking oil', use: 'butter or margarine, on lower heat', note: 'Butter burns sooner, so keep the pan moderate.' },
  { missing: 'baking powder', use: '½ tsp bicarb + ¼ tsp lemon juice per tsp of baking powder', note: 'Mix and use immediately — it starts working at once.' },
]

export function findSubstitutes(missing: string[], have: string[]) {
  const out: { missing: string; use: string; note: string }[] = []
  for (const m of missing) {
    const hit = SUBSTITUTIONS.find((s) => sameIngredient(s.missing, m))
    if (hit) {
      // prefer a substitution the user actually has
      const alt = PANTRY.find((p) => have.includes(p.name) && sameIngredient(hit.use, p.name))
      out.push(alt ? { ...hit, use: `${alt.name} — ${hit.use}` } : hit)
    } else {
      out.push({ missing: m, use: 'this can usually just be left out', note: 'Taste at the end and adjust the seasoning.' })
    }
  }
  return out
}

/* ------------------------------------------------------------------ recipes */

export interface MethodStep {
  title: string
  detail: string
  durationSec?: number
  check?: string
  tip?: string
  diagram?: Step['diagram']
}

export interface RecipeTemplate {
  name: string
  tagline: string
  cuisine: string
  minutes: number
  difficulty: Difficulty
  servings: number
  core: string[]
  optional?: string[]
  /** any one of these satisfies the requirement */
  coreAny?: string[][]
  need: string[]
  method: MethodStep[]
  costZar?: number
}

const heat = (level: string, detail: string, check?: string, sec?: number): MethodStep => ({
  title: level,
  detail,
  check,
  durationSec: sec,
})

export const RECIPES: RecipeTemplate[] = [
  {
    name: 'Shakshuka',
    tagline: 'Eggs poached in a spiced tomato sauce',
    cuisine: 'Middle Eastern / North African',
    minutes: 25,
    difficulty: 'easy',
    servings: 2,
    core: ['eggs', 'tomatoes'],
    optional: ['onion', 'garlic', 'green pepper', 'chilli', 'bread', 'mixed herbs'],
    need: ['stovetop', 'frying pan'],
    costZar: 55,
    method: [
      { title: 'Warm the pan', detail: 'Put your widest pan on medium heat with two tablespoons of oil. It is ready when a drop of the sauce you are about to make sizzles at the edge.', durationSec: 120 },
      { title: 'Soften the onion', detail: 'Chop the onion and cook it until it goes see-through and starts to colour at the edges, about 6 minutes. Stir every minute or so.', durationSec: 360, check: 'Onion looks glassy, not brown.' },
      { title: 'Add garlic and spice', detail: 'Add the garlic and a teaspoon each of cumin or curry powder and paprika. Stir for 30 seconds — it should smell warm, not burnt.', durationSec: 30, tip: 'Burnt garlic turns bitter. If it darkens, start again with fresh oil.' },
      { title: 'Cook down the tomatoes', detail: 'Add chopped tomatoes, half a teaspoon of salt and a splash of water. Simmer 10 minutes with the lid ajar until it thickens to a passata consistency — a spoon dragged through leaves a clear line.', durationSec: 600, check: 'The sauce holds a line behind the spoon.' },
      { title: 'Make wells and add the eggs', detail: 'Press the back of a spoon into the sauce to make one hollow per egg. Crack each egg into a cup first, then slide it in. This keeps the yolk whole and lets you fish out shell pieces.', durationSec: 120 },
      { title: 'Cover and poach', detail: 'Cover the pan and cook on low for 5–7 minutes. The whites should be set and the yolks still soft. Do not judge by sight alone — nudge a white with a spoon; if it is firm, it is done.', durationSec: 360, check: 'Egg white is opaque and firm to a gentle nudge; yolk still wobbles.' },
      { title: 'Rest and serve', detail: 'Take the pan off the heat and rest 2 minutes. Scatter herbs and serve straight from the pan with bread to mop up.', durationSec: 120 },
    ],
  },
  {
    name: 'Tomato and onion omelette',
    tagline: 'The fastest proper meal in the house',
    cuisine: 'Everyday',
    minutes: 12,
    difficulty: 'easy',
    servings: 1,
    core: ['eggs'],
    optional: ['tomatoes', 'onion', 'cheese', 'mushrooms', 'green pepper', 'bread'],
    need: ['stovetop', 'frying pan'],
    costZar: 25,
    method: [
      { title: 'Beat the eggs', detail: 'Crack 3 eggs into a bowl, add a pinch of salt and a tablespoon of water (not milk — water makes it fluffier). Beat with a fork for 30 seconds until no streaks of white remain.', durationSec: 90 },
      { title: 'Prep the filling', detail: 'Dice the tomato and onion small — about the size of a pea. Large wet pieces make the omelette tear.', durationSec: 120 },
      { title: 'Warm the pan properly', detail: 'Medium heat, a tablespoon of oil, and wait until it shimmers. If the pan is too cool the egg sticks, if it is too hot the bottom burns before the middle sets.', durationSec: 90, check: 'Oil shimmers and moves in thin lines.' },
      { title: 'Cook the filling first', detail: 'Fry the onion for 3 minutes, then the tomato for 2 more. Season and tip onto a plate. Wipe the pan so the egg gets a clean surface.', durationSec: 300 },
      { title: 'Cook the egg', detail: 'Pour in the egg and swirl to cover the pan. As the edges set, drag them toward the middle with a spatula and tilt the pan so raw egg runs underneath — about 90 seconds.', durationSec: 90, check: 'Top is still glossy but no longer runny.' },
      { title: 'Fill and fold', detail: 'Put the filling on one half, add cheese if you have it, and fold the other half over. Slide onto a plate. Carry-over heat finishes the middle.', durationSec: 60, tip: 'The centre should be just set. If it still looks wet after folding, give it 30 more seconds in the pan.' },
    ],
  },
  {
    name: 'French toast',
    tagline: 'Stale bread is better than fresh here',
    cuisine: 'Comfort',
    minutes: 15,
    difficulty: 'easy',
    servings: 2,
    core: ['bread', 'eggs'],
    optional: ['milk', 'cinnamon', 'sugar', 'butter', 'banana', 'honey', 'jam'],
    need: ['stovetop', 'frying pan'],
    costZar: 30,
    method: [
      { title: 'Mix the batter', detail: 'Beat 2 eggs with 100 ml milk, a tablespoon of sugar and a pinch of cinnamon in a shallow dish wide enough for a slice of bread.', durationSec: 120 },
      { title: 'Heat the pan', detail: 'Medium-low heat with a knob of butter. Butter should foam gently, not brown and smoke.', durationSec: 90, check: 'Foams and smells nutty.' },
      { title: 'Soak, briefly', detail: 'Dip each slice for about 3 seconds a side. Any longer and the middle goes to mush.', durationSec: 60, tip: 'Day-old bread holds up far better than fresh.' },
      { title: 'Fry', detail: 'Fry 2–3 minutes a side until deep golden. Do not crowd the pan — you want the edges crisp, not steamed.', durationSec: 300, check: 'Deep golden brown with crisp edges.' },
      { title: 'Serve straight away', detail: 'Stack on a warm plate with banana, honey, jam or just sugar and cinnamon.', durationSec: 60 },
    ],
  },
  {
    name: 'Chicken and tomato skillet',
    tagline: 'One pan, stovetop only',
    cuisine: 'Everyday',
    minutes: 40,
    difficulty: 'easy',
    servings: 4,
    core: ['chicken', 'tomatoes'],
    optional: ['onion', 'garlic', 'green pepper', 'curry powder', 'rice', 'bread', 'pap'],
    need: ['stovetop', 'frying pan'],
    costZar: 120,
    method: [
      { title: 'Season the chicken', detail: 'Pat the pieces dry with paper towel — dry skin browns, wet skin steams. Season all over with salt, pepper and a teaspoon of paprika.', durationSec: 180, tip: 'Dry chicken is the single biggest difference between good and average browning.' },
      { title: 'Brown, do not cook through', detail: 'Hot pan, a little oil, and lay the pieces in skin-side down. Leave them alone for 5 minutes. They will release on their own when they are ready to turn.', durationSec: 600, check: 'Deep golden crust; meat pulls away from the pan without tearing.' },
      { title: 'Take the chicken out', detail: 'Move the pieces to a plate. It is not cooked yet — that happens in the sauce.', durationSec: 60 },
      { title: 'Build the base', detail: 'In the same pan, cook the onion for 5 minutes, then garlic and pepper for 2. Add curry powder or herbs and stir 30 seconds. The browned bits on the pan bottom are the flavour — scrape them up with the vegetables.', durationSec: 480 },
      { title: 'Add tomatoes and return the chicken', detail: 'Add chopped tomatoes, a splash of water and a stock cube. Nestle the chicken back in, skin-side up, so it stays above the liquid and keeps its crust.', durationSec: 120 },
      { title: 'Simmer until safe', detail: 'Cover and simmer on low for 20 minutes. Chicken is done when the thickest part reads 74 °C — cut into the thickest piece and check there is no pink and the juices run clear, not pink.', durationSec: 1200, check: 'Thickest part is white all the way through and juices run clear. Do not judge by the outside colour.' },
      { title: 'Rest and serve', detail: 'Rest 5 minutes, then serve over rice or with pap or bread.', durationSec: 300 },
    ],
  },
  {
    name: 'Chicken and spinach pasta',
    tagline: 'Creamy without needing cream',
    cuisine: 'Italian-ish',
    minutes: 30,
    difficulty: 'easy',
    servings: 4,
    core: ['chicken', 'pasta'],
    optional: ['spinach', 'garlic', 'onion', 'cream', 'cheese', 'milk', 'mushrooms'],
    need: ['stovetop', 'pot', 'frying pan'],
    costZar: 130,
    method: [
      { title: 'Boil the pasta', detail: 'Big pot of well-salted water — it should taste like the sea. Boil the pasta for one minute less than the packet says. Keep a mug of the cooking water before you drain.', durationSec: 600, check: 'Bite a piece: firm centre, no raw flour taste.' },
      { title: 'Cook the chicken', detail: 'Slice into strips and fry in a hot pan for 5 minutes until golden and cooked through — no pink in the middle of the thickest strip.', durationSec: 420, check: 'No pink inside; firm to the touch.' },
      { title: 'Garlic and spinach', detail: 'Lower the heat, add the garlic for 30 seconds, then the spinach a handful at a time. It collapses in under a minute.', durationSec: 120 },
      { title: 'Make it creamy', detail: 'Add a splash of milk or cream and a spoon of the pasta water. The starch in the water is what makes the sauce cling instead of pooling.', durationSec: 120, tip: 'No cream? Milk plus a knob of butter, added off the boil, works.' },
      { title: 'Combine off the heat', detail: 'Tip the drained pasta into the pan and toss. Adding dairy off the heat stops it splitting.', durationSec: 60 },
      { title: 'Season and serve', detail: 'Taste, then add salt, pepper and cheese if you have it.', durationSec: 60 },
    ],
  },
  {
    name: 'Mince and rice',
    tagline: 'The reliable weeknight standby',
    cuisine: 'South African',
    minutes: 35,
    difficulty: 'easy',
    servings: 4,
    core: ['beef mince', 'rice'],
    optional: ['onion', 'carrots', 'peas', 'tinned tomatoes', 'curry powder', 'stock cubes', 'potatoes'],
    need: ['stovetop', 'pot', 'frying pan'],
    costZar: 110,
    method: [
      { title: 'Start the rice', detail: 'One cup of rice, two cups of water, half a teaspoon of salt. Bring to a boil, then the lowest heat with the lid on for 15 minutes. Do not stir, and do not lift the lid.', durationSec: 900, check: 'Water is absorbed and small steam holes cover the surface.' },
      { title: 'Brown the mince', detail: 'Dry pan, high heat. Add the mince and leave it for 3 minutes before breaking it up — that gives you browning instead of grey mince. Pour off any fat.', durationSec: 420, check: 'Deep brown crust on the underside of the meat.' },
      { title: 'Onions and spice', detail: 'Add the onion and carrot for 5 minutes, then a tablespoon of curry powder for 30 seconds.', durationSec: 360 },
      { title: 'Liquid and simmer', detail: 'Add tinned tomatoes and a crumbled stock cube with a splash of water. Simmer 10 minutes until the sauce is thick, not soupy.', durationSec: 600, check: 'A spoon dragged through leaves a clear line.' },
      { title: 'Rest the rice', detail: 'Off the heat, keep the lid on and rest 5 minutes, then fluff with a fork.', durationSec: 300 },
      { title: 'Plate up', detail: 'Serve the mince over rice. Good with chutney or a squeeze of lemon.', durationSec: 60 },
    ],
  },
  {
    name: 'Chakalaka',
    tagline: 'Spicy vegetable relish that goes with everything',
    cuisine: 'South African',
    minutes: 30,
    difficulty: 'easy',
    servings: 6,
    core: ['carrots', 'tinned tomatoes'],
    optional: ['onion', 'green pepper', 'curry powder', 'kidney beans', 'cabbage', 'chilli', 'corn'],
    need: ['stovetop', 'pot'],
    costZar: 45,
    method: [
      { title: 'Prepare the vegetables', detail: 'Grate the carrots coarsely and slice the peppers and onion thin. Grated carrot gives the right texture — chopped carrot stays crunchy.', durationSec: 300 },
      { title: 'Soften', detail: 'Fry the onion and pepper in oil for 5 minutes until soft.', durationSec: 300 },
      { title: 'Spice', detail: 'Add a tablespoon of curry powder and stir for 30 seconds until it smells fragrant.', durationSec: 30 },
      { title: 'Add the rest', detail: 'Add grated carrot and tinned tomatoes. Cook uncovered for 15 minutes, stirring now and then, until it thickens and the carrot is soft.', durationSec: 900, check: 'Carrot is soft; mixture holds together on a spoon.' },
      { title: 'Beans last', detail: 'Add the beans (if using) for the final 3 minutes so they stay whole.', durationSec: 180 },
      { title: 'Season and rest', detail: 'Salt, a pinch of sugar if the tomatoes are sharp, and rest 5 minutes. It tastes better the next day.', durationSec: 300 },
    ],
  },
  {
    name: 'Tuna pasta',
    tagline: 'Ten minutes from cupboard to plate',
    cuisine: 'Everyday',
    minutes: 18,
    difficulty: 'easy',
    servings: 2,
    core: ['pasta', 'tinned tuna'],
    optional: ['onion', 'garlic', 'tomatoes', 'tinned tomatoes', 'sweetcorn', 'mayonnaise', 'chilli', 'cheese', 'lemon'],
    need: ['stovetop', 'pot'],
    costZar: 55,
    method: [
      { title: 'Boil the pasta', detail: 'Salted boiling water, one minute under the packet time. Save a mug of the water before draining.', durationSec: 480 },
      { title: 'Warm the flavour base', detail: 'In a separate pan, gently cook garlic and onion in oil for 4 minutes — no browning needed, just softness.', durationSec: 240 },
      { title: 'Add tomatoes', detail: 'Add chopped or tinned tomatoes and simmer 5 minutes to cook out the raw edge.', durationSec: 300, check: 'The sauce darkens slightly and loses its raw smell.' },
      { title: 'Tuna in, gently', detail: 'Drain the tuna and fold it in off the heat so it stays in flakes instead of turning to paste.', durationSec: 60, tip: 'Tinned tuna is already cooked. Heating it hard is what makes it dry.' },
      { title: 'Combine', detail: 'Toss the pasta through with a splash of the cooking water to loosen it.', durationSec: 60 },
      { title: 'Finish', detail: 'Lemon, chilli, cheese or a spoon of mayonnaise — any one of them lifts it.', durationSec: 30 },
    ],
  },
  {
    name: 'Pap and tomato relish',
    tagline: 'Cheap, filling and quick',
    cuisine: 'South African',
    minutes: 25,
    difficulty: 'easy',
    servings: 4,
    core: ['maize meal'],
    optional: ['tomatoes', 'onion', 'tinned tomatoes', 'boerewors', 'kidney beans', 'curry powder'],
    need: ['stovetop', 'pot'],
    costZar: 30,
    method: [
      { title: 'Boil the water', detail: 'Three cups of water with a teaspoon of salt in a heavy pot. It must be at a rolling boil before the meal goes in.', durationSec: 300, check: 'Big bubbles breaking across the whole surface.' },
      { title: 'Rain in the meal', detail: 'Add one and a half cups of maize meal in a slow stream while stirring in one direction with a wooden spoon. Stirring the same way keeps it smooth.', durationSec: 120, tip: 'Lumps come from adding it too fast or not stirring the bottom.' },
      { title: 'Steam it', detail: 'Turn the heat to its lowest, cover, and steam 15 minutes. Stir from the bottom every 5 minutes or it catches and burns.', durationSec: 900, check: 'Thick enough that the spoon stands up on its own.' },
      { title: 'Make the relish', detail: 'In another pan, fry onion for 4 minutes, add tomatoes and a pinch of sugar, and cook 8 minutes until jammy.', durationSec: 720 },
      { title: 'Serve', detail: 'Wet your spoon or a small bowl so the pap releases cleanly, and serve with the relish.', durationSec: 60 },
    ],
  },
  {
    name: 'Beans and butternut stew',
    tagline: 'Meat-free, filling, very cheap',
    cuisine: 'Home cooking',
    minutes: 35,
    difficulty: 'easy',
    servings: 4,
    core: ['kidney beans', 'butternut'],
    optional: ['onion', 'garlic', 'tinned tomatoes', 'curry powder', 'spinach', 'rice', 'samp', 'lentils'],
    need: ['stovetop', 'pot'],
    costZar: 50,
    method: [
      { title: 'Cube the butternut', detail: 'Peel and cut into 3 cm chunks — roughly the size of a golf ball cut in four. Even sizes cook evenly.', durationSec: 300 },
      { title: 'Start the base', detail: 'Fry the onion in oil for 5 minutes, add garlic and a tablespoon of curry powder, and stir 30 seconds.', durationSec: 360 },
      { title: 'Add the butternut', detail: 'Add the butternut and stir to coat it in the spices, then add tinned tomatoes and a cup of water. Salt now — it seasons the squash from the inside.', durationSec: 120 },
      { title: 'Simmer covered', detail: 'Cover and simmer 20 minutes. The butternut is done when a knife slides in with no resistance.', durationSec: 1200, check: 'Knife goes through a chunk with no resistance.' },
      { title: 'Add the beans', detail: 'Fold in the beans and warm through for 3 minutes, then mash a few chunks against the side of the pot to thicken the sauce.', durationSec: 240 },
      { title: 'Serve', detail: 'Over rice, samp or with bread.', durationSec: 60 },
    ],
  },
  {
    name: 'Cabbage and potato fry',
    tagline: 'Turns the cheapest vegetables into something you want seconds of',
    cuisine: 'Home cooking',
    minutes: 30,
    difficulty: 'easy',
    servings: 4,
    core: ['cabbage', 'potatoes'],
    optional: ['onion', 'carrots', 'curry powder', 'paprika', 'chilli', 'bacon'],
    need: ['stovetop', 'frying pan'],
    costZar: 32,
    method: [
      { title: 'Slice thin', detail: 'Slice the cabbage and potatoes about 3 mm thick. Thin and even is what makes them cook through in one pan.', durationSec: 420 },
      { title: 'Fry the onion', detail: 'Oil in a wide pan on medium, onion for 4 minutes until soft.', durationSec: 240 },
      { title: 'Potatoes first', detail: 'Add the potato slices in one layer with a good pinch of salt, cover, and cook 8 minutes. They need a head start on the cabbage.', durationSec: 480, check: 'Edges of the slices are translucent and they bend without breaking.' },
      { title: 'Add the cabbage and spice', detail: 'Add cabbage, paprika or curry powder, and a splash of water. Toss, cover, and cook 8 minutes. Do not cook it to death — a little bite is better.', durationSec: 480, check: 'Stems are tender, leaves still bright.' },
      { title: 'Finish hot', detail: 'Uncover, turn the heat up for 2 minutes to drive off the last water, then adjust the salt.', durationSec: 120 },
    ],
  },
  {
    name: 'Jacket potato with everything',
    tagline: 'Microwave first, then crisp',
    cuisine: 'Comfort',
    minutes: 25,
    difficulty: 'easy',
    servings: 2,
    core: ['potatoes'],
    optional: ['cheese', 'butter', 'kidney beans', 'tinned tuna', 'corn', 'yoghurt', 'spring onion'],
    need: ['microwave', 'oven'],
    costZar: 40,
    method: [
      { title: 'Prick and season', detail: 'Stab each potato 6 times with a fork, rub with oil and a lot of salt. The oil is what makes the skin crisp.', durationSec: 120 },
      { title: 'Microwave first', detail: '8 minutes on high for two large potatoes, turning halfway. This does the cooking.', durationSec: 480, check: 'A knife slides into the centre with no resistance.' },
      { title: 'Crisp in the oven', detail: '10 minutes at 220 °C directly on the rack. This is the step that makes the skin worth eating.', durationSec: 600, check: 'Skin is dry and crackly to tap.' },
      { title: 'Build the filling', detail: 'Warm the beans or tuna with a spoon of yoghurt or mayonnaise. Split the potato, fluff the inside with a fork, season again.', durationSec: 180 },
      { title: 'Pile it up', detail: 'Fill, top with cheese and spring onion, and eat immediately.', durationSec: 60 },
    ],
  },
  {
    name: 'Fried rice from leftovers',
    tagline: 'Built for cold rice, not fresh',
    cuisine: 'Asian-ish',
    minutes: 20,
    difficulty: 'easy',
    servings: 3,
    core: ['rice'],
    coreAny: [['eggs', 'chicken', 'tinned tuna', 'bacon', 'polony', 'peas']],
    optional: ['carrots', 'peas', 'onion', 'garlic', 'soy sauce', 'spring onion', 'green pepper', 'cabbage'],
    need: ['stovetop', 'frying pan'],
    costZar: 45,
    method: [
      { title: 'Use cold rice', detail: 'Day-old rice from the fridge is essential — fresh rice steams and clumps. Break up any lumps with wet hands.', durationSec: 120, tip: 'No cold rice? Spread fresh rice on a tray and freeze 15 minutes.' },
      { title: 'Prep everything first', detail: 'Dice all the vegetables small and have the sauce ready. Stir-frying moves too fast to chop halfway through.', durationSec: 300 },
      { title: 'Scramble the egg', detail: 'Hot pan, a little oil, pour in the beaten egg, and take it out while it is still slightly wet. Set aside.', durationSec: 90, check: 'Just set — no browning.' },
      { title: 'Fry the hard vegetables', detail: 'Carrot and onion first for 3 minutes, then softer things like peas and cabbage for 2.', durationSec: 300 },
      { title: 'Rice in, high heat', detail: 'Add the rice and press it flat against the pan for a minute at a time, letting it toast before you stir. That crust is the whole point.', durationSec: 300, check: 'Some grains are speckled brown.' },
      { title: 'Sauce and egg back in', detail: 'Splash in soy sauce around the edge of the pan (it caramelises on contact), return the egg, toss, and serve.', durationSec: 120 },
    ],
  },
  {
    name: 'Cheese toastie',
    tagline: 'Better with a dry pan than a machine',
    cuisine: 'Snack',
    minutes: 10,
    difficulty: 'easy',
    servings: 1,
    core: ['bread', 'cheese'],
    optional: ['tomatoes', 'onion', 'butter', 'mayonnaise', 'polony', 'chutney'],
    need: ['stovetop', 'frying pan'],
    costZar: 22,
    method: [
      { title: 'Butter the outside, not the inside', detail: 'Spread butter or mayonnaise on the outside faces of the bread. That is what crisps; the inside only needs the cheese.', durationSec: 60, tip: 'Mayonnaise browns more evenly than butter.' },
      { title: 'Grate the cheese', detail: 'Grated cheese melts evenly; slices leave cold patches. Pile it in the middle and leave a 1 cm border.', durationSec: 120 },
      { title: 'Dry pan, medium-low', detail: 'No oil needed. Medium-low heat, because you are waiting for the cheese to melt before the bread burns.', durationSec: 60, check: 'Pan is warm enough that a drop of water sizzles and disappears.' },
      { title: 'Press and wait', detail: 'Press with a spatula for 3 minutes, then flip carefully and give it 2–3 more. Do not keep checking — you lose the crust each time you lift it.', durationSec: 360, check: 'Deep golden. Cheese should just start to escape at the edges.' },
      { title: 'Rest 1 minute', detail: 'The cheese is molten straight from the pan and will run out. A minute off the heat sets it enough to bite.', durationSec: 60 },
    ],
  },
  {
    name: 'Creamy oats with banana',
    tagline: 'Two minutes, no pan needed',
    cuisine: 'Breakfast',
    minutes: 8,
    difficulty: 'easy',
    servings: 1,
    core: ['oats'],
    optional: ['banana', 'milk', 'honey', 'cinnamon', 'peanut butter', 'apple', 'sugar'],
    need: ['microwave'],
    costZar: 18,
    method: [
      { title: 'Measure into a bowl', detail: 'Half a cup of oats with a cup of milk or water in a bowl twice the size you think you need — oats climb when they boil.', durationSec: 60 },
      { title: 'Microwave in bursts', detail: '2 minutes on high, stir, then 1 minute more. Stirring breaks the surface tension so it does not boil over.', durationSec: 180, check: 'Thick and creamy, not watery at the edge.' },
      { title: 'Loosen it', detail: 'It thickens as it stands. Splash in more milk and stir until it flows off the spoon.', durationSec: 30 },
      { title: 'Top it', detail: 'Banana, a spoon of peanut butter, honey and cinnamon. Salt is not a mistake here — a pinch makes the sweetness sing.', durationSec: 45 },
    ],
  },
  {
    name: 'Vegetable soup',
    tagline: 'Whatever is in the fridge drawer',
    cuisine: 'Home cooking',
    minutes: 45,
    difficulty: 'easy',
    servings: 6,
    core: [],
    coreAny: [['potatoes', 'butternut', 'carrots', 'cabbage', 'green beans', 'peas', 'broccoli', 'mixed vegetables', 'lentils', 'kidney beans']],
    optional: ['onion', 'garlic', 'stock cubes', 'mixed herbs', 'bread', 'tinned tomatoes', 'pasta', 'rice'],
    need: ['stovetop', 'pot'],
    costZar: 40,
    method: [
      { title: 'Soften the aromatics', detail: 'Onion and garlic in oil for 6 minutes — this is the base and the only step you cannot rush.', durationSec: 360 },
      { title: 'Add the hard vegetables', detail: 'Carrot, potato, butternut and any root vegetable first, stirred for 3 minutes to coat.', durationSec: 180 },
      { title: 'Cover with liquid', detail: 'Water or stock, enough to cover by 3 cm, plus a crumbled stock cube and bay leaves. Simmer 20 minutes.', durationSec: 1200 },
      { title: 'Add the soft vegetables', detail: 'Cabbage, peas, spinach and tomato in the last 10 minutes. Adding them early turns them grey and tasteless.', durationSec: 600, check: 'Everything is tender but still holds its shape.' },
      { title: 'Thicken or leave chunky', detail: 'For a thicker soup, blend a third of it and stir it back in. That gives body while keeping texture.', durationSec: 180 },
      { title: 'Season at the end', detail: 'Salt, pepper and a splash of vinegar or lemon — acid is what makes vegetable soup taste finished instead of flat.', durationSec: 60 },
    ],
  },
  {
    name: 'Mealie bread',
    tagline: 'No oven needed on a stovetop',
    cuisine: 'South African',
    minutes: 40,
    difficulty: 'medium',
    servings: 6,
    core: ['maize meal', 'flour'],
    optional: ['corn', 'eggs', 'milk', 'sugar', 'butter', 'baking powder'],
    need: ['stovetop', 'pot'],
    costZar: 35,
    method: [
      { title: 'Mix the dry', detail: 'One cup maize meal, one cup flour, two teaspoons baking powder, two tablespoons sugar and a pinch of salt. Whisk so the baking powder is evenly spread — lumps of it taste bitter.', durationSec: 120 },
      { title: 'Add the wet', detail: 'One egg, one cup milk and two tablespoons melted butter. Stir until just combined. Over-mixing makes it tough.', durationSec: 120, check: 'Batter drops off the spoon in a thick ribbon.' },
      { title: 'Prepare the pot', detail: 'A heavy pot with a tight lid, greased, lined with baking paper if you have it. Put a trivet or an upturned metal plate in the bottom and add 2 cm of water — you are steaming, not frying.', durationSec: 180 },
      { title: 'Steam it', detail: 'Pour the batter into a greased tin that fits inside the pot, cover with a lid and steam on medium-low for 30 minutes. Check the water once or twice and top it up.', durationSec: 1800, check: 'A skewer in the centre comes out clean.' },
      { title: 'Rest before cutting', detail: 'Turn out and rest 10 minutes. Cutting hot bread makes it crumble.', durationSec: 600 },
    ],
  },
  {
    name: 'Lentil curry',
    tagline: 'Cheap protein that tastes like a proper curry',
    cuisine: 'Indian',
    minutes: 40,
    difficulty: 'easy',
    servings: 4,
    core: ['lentils'],
    optional: ['onion', 'garlic', 'ginger', 'tinned tomatoes', 'curry powder', 'spinach', 'rice', 'potatoes', 'yoghurt'],
    need: ['stovetop', 'pot'],
    costZar: 42,
    method: [
      { title: 'Rinse the lentils', detail: 'Rinse until the water runs clear. Any grit settles at the bottom of the packet, so rinse in a bowl, not a sieve.', durationSec: 60 },
      { title: 'Fry the aromatics', detail: 'Onion for 5 minutes, then garlic and ginger for 1, then two tablespoons of curry powder for 30 seconds. This is where the flavour is built.', durationSec: 420 },
      { title: 'Toast the lentils in the spices', detail: 'Add the drained lentils and stir for a minute before any liquid goes in. It makes them taste roasted rather than boiled.', durationSec: 60 },
      { title: 'Simmer', detail: 'Add tinned tomatoes and three cups of water. Simmer 25 minutes until the lentils are soft but still hold their shape.', durationSec: 1500, check: 'A lentil squashes easily between your fingers.' },
      { title: 'Finish', detail: 'Stir in spinach in the last 2 minutes. A spoon of yoghurt off the heat makes it creamier and less sharp.', durationSec: 120 },
      { title: 'Serve', detail: 'With rice, roti or bread.', durationSec: 60 },
    ],
  },
  {
    name: 'Potato and egg hash',
    tagline: 'Breakfast-for-dinner, ten minutes with leftover potatoes',
    cuisine: 'Comfort',
    minutes: 20,
    difficulty: 'easy',
    servings: 2,
    core: ['potatoes', 'eggs'],
    optional: ['onion', 'green pepper', 'bacon', 'polony', 'cheese', 'chilli', 'mixed herbs'],
    need: ['stovetop', 'frying pan'],
    costZar: 30,
    method: [
      { title: 'Cube and dry', detail: 'Cube cooked potatoes and pat them dry. Wet potatoes will not brown, they will only steam.', durationSec: 180, tip: 'This is the best use for potatoes left over from last night.' },
      { title: 'Get them crisp', detail: 'Generous oil in a wide pan on medium-high. Spread them out in one layer and leave them alone for 5 minutes until a crust forms on the bottom.', durationSec: 300, check: 'Faces are deep golden and release from the pan.' },
      { title: 'Add onion and pepper', detail: 'Push the potatoes to one side, cook the onion and pepper in the free space for 4 minutes, then mix together.', durationSec: 240 },
      { title: 'Make wells', detail: 'Make hollows and crack an egg into each. Season the eggs, cover the pan, and cook 4 minutes for a soft yolk and set white.', durationSec: 240, check: 'White is fully opaque; yolk still gives when the pan is nudged.' },
      { title: 'Finish on the plate', detail: 'Cheese, chilli sauce or herbs on top.', durationSec: 45 },
    ],
  },
  {
    name: 'Tinned fish bredie with bread',
    tagline: 'Ready in 15 minutes from a cupboard raid',
    cuisine: 'Cape',
    minutes: 20,
    difficulty: 'easy',
    servings: 3,
    core: ['tinned pilchards'],
    optional: ['onion', 'tomatoes', 'tinned tomatoes', 'potatoes', 'curry powder', 'bread', 'rice', 'chilli'],
    need: ['stovetop', 'pot'],
    costZar: 38,
    method: [
      { title: 'Onions properly soft', detail: 'Fry the onion slowly in oil for 8 minutes — longer than you think. This is what makes a bredie taste like it simmered for hours.', durationSec: 480, check: 'Onion is sweet, soft and pale gold.' },
      { title: 'Spice and tomato', detail: 'Add curry powder for 30 seconds, then tomatoes, and cook 5 minutes until the sauce darkens.', durationSec: 330 },
      { title: 'Fish in, gently', detail: 'Tip in the pilchards with their sauce and break them up lightly with a fork. Do not stir hard — you want pieces, not paste.', durationSec: 120 },
      { title: 'Warm through', detail: 'Five minutes on low heat, no boiling. Tinned fish falls apart under high heat.', durationSec: 300 },
      { title: 'Serve with bread', detail: 'This is better with thick bread than with rice.', durationSec: 60 },
    ],
  },
  {
    name: 'Banana flapjacks',
    tagline: 'Three ingredients if you are counting',
    cuisine: 'Breakfast',
    minutes: 20,
    difficulty: 'easy',
    servings: 3,
    core: ['flour', 'eggs'],
    coreAny: [['banana', 'milk']],
    optional: ['sugar', 'cinnamon', 'baking powder', 'butter', 'honey', 'oats'],
    need: ['stovetop', 'frying pan'],
    costZar: 26,
    method: [
      { title: 'Make the batter', detail: 'One cup flour, one teaspoon baking powder, one tablespoon sugar, one egg and three-quarters of a cup milk. Mash in a banana if you have one.', durationSec: 240, tip: 'Banana also lets you cut the sugar in half.' },
      { title: 'Let it stand', detail: 'Rest 5 minutes. The flour hydrates and the baking powder starts working — the difference in texture is obvious.', durationSec: 300 },
      { title: 'Heat low, and be patient', detail: 'Medium-low with a light wipe of oil. Flapjacks burn outside while staying raw inside on high heat.', durationSec: 120, check: 'A drop of batter sets in about 20 seconds.' },
      { title: 'Look for bubbles', detail: 'Pour 3 cm rounds. Wait until bubbles break across the surface and the edges look dry — that is the signal to flip, about 2 minutes.', durationSec: 300, check: 'Bubbles pop on top and the rim is matte, not glossy.' },
      { title: 'Flip once, briefly', detail: '45 seconds on the second side. Stack as you go.', durationSec: 240 },
    ],
  },
  {
    name: 'Corn fritters',
    tagline: 'Sweet, crisp and hard to stop eating',
    cuisine: 'Snack',
    minutes: 22,
    difficulty: 'easy',
    servings: 4,
    core: ['corn', 'flour'],
    optional: ['eggs', 'spring onion', 'chilli', 'cheese', 'yoghurt', 'milk'],
    need: ['stovetop', 'frying pan'],
    costZar: 32,
    method: [
      { title: 'Mix', detail: 'A cup of corn, a cup of flour, one egg, a teaspoon of baking powder, salt, pepper and a splash of milk to bring it to a thick dropping consistency.', durationSec: 240 },
      { title: 'Season hard', detail: 'Corn is sweet, so it needs more salt and pepper than you expect. Add spring onion or chilli if you have them.', durationSec: 60 },
      { title: 'Shallow fry', detail: '1 cm of oil at medium heat. Test with a grain of batter — it should rise and sizzle without browning instantly.', durationSec: 180, check: 'Batter sinks then rises immediately.' },
      { title: 'Fry in batches', detail: 'Two heaped tablespoons per fritter, flattened slightly. 3 minutes a side until deep gold. Do not crowd the pan — they need the heat.', durationSec: 420, check: 'Deep golden, firm to press in the middle.' },
      { title: 'Drain and eat hot', detail: 'Drain on paper towel. They lose their crisp fast, so serve immediately, with yoghurt or chutney.', durationSec: 120 },
    ],
  },
  {
    name: 'Tomato pasta',
    tagline: 'Three ingredients, twenty minutes',
    cuisine: 'Italian',
    minutes: 22,
    difficulty: 'easy',
    servings: 3,
    core: ['pasta'],
    coreAny: [['tomatoes', 'tinned tomatoes', 'tomato sauce']],
    optional: ['garlic', 'onion', 'chilli', 'mixed herbs', 'cheese', 'butter'],
    need: ['stovetop', 'pot'],
    costZar: 35,
    method: [
      { title: 'Salted boiling water', detail: 'A big pot, lots of water, a tablespoon of salt. Pasta needs room to move or it sticks.', durationSec: 300 },
      { title: 'Start the sauce first', detail: 'Oil, garlic on low heat for 1 minute — barely coloured. Add the tomatoes, a pinch of sugar and salt, and simmer while the pasta cooks.', durationSec: 300, tip: 'The pinch of sugar is the fix for tomatoes that taste sharp.' },
      { title: 'Cook the pasta short', detail: 'One minute less than the packet. Keep a mug of the water.', durationSec: 480, check: 'Firm to bite, no raw flour taste.' },
      { title: 'Finish in the sauce', detail: 'Drain, tip into the sauce, and toss over heat for 60 seconds with a splash of the pasta water. The sauce clings instead of sitting on top.', durationSec: 60, check: 'Every strand is coated and the pan looks glossy, not watery.' },
      { title: 'Butter at the end', detail: 'A knob of butter or a splash of oil off the heat makes the sauce silky. Cheese if you have it.', durationSec: 30 },
    ],
  },
  {
    name: 'Spiced chicken wraps',
    tagline: 'Dinner you can eat with one hand',
    cuisine: 'Fast food at home',
    minutes: 25,
    difficulty: 'easy',
    servings: 4,
    core: ['chicken', 'tortillas'],
    optional: ['onion', 'green pepper', 'lettuce', 'tomatoes', 'mayonnaise', 'chilli', 'yoghurt', 'cheese', 'avocado'],
    need: ['stovetop', 'frying pan'],
    costZar: 115,
    method: [
      { title: 'Slice thin and season', detail: 'Cut the chicken into finger-width strips so it cooks in minutes. Season with paprika, salt, pepper and a little oil.', durationSec: 300 },
      { title: 'Very hot pan', detail: 'Get the pan properly hot before the chicken goes in, then spread the strips in one layer. Crowding steams the meat.', durationSec: 180, check: 'Chicken sizzles loudly on contact.' },
      { title: 'Cook through', detail: '4 minutes, turn, 3 more. No pink in the centre of the thickest strip — cut one open to check rather than guessing from the outside.', durationSec: 420, check: 'Cut the thickest strip: white all the way through, juices clear.' },
      { title: 'Soften the veg', detail: 'In the same pan, cook onion and pepper for 4 minutes, scraping up the browned bits.', durationSec: 240 },
      { title: 'Warm the wraps', detail: 'Dry pan, 20 seconds a side. Cold wraps crack when you fold them.', durationSec: 120, check: 'Pliable and steaming slightly.' },
      { title: 'Build', detail: 'Sauce first so it glues the filling, then chicken, vegetables and anything cold last. Fold the bottom up before rolling, or it all falls out.', durationSec: 180 },
    ],
  },
  {
    name: 'Avocado and tomato on toast',
    tagline: 'When nobody wants to cook',
    cuisine: 'Light',
    minutes: 8,
    difficulty: 'easy',
    servings: 1,
    core: ['bread', 'avocado'],
    optional: ['tomatoes', 'lemon', 'chilli', 'eggs', 'cheese', 'black pepper', 'spring onion'],
    need: ['toaster'],
    costZar: 28,
    method: [
      { title: 'Toast hard', detail: 'Toast until it is genuinely crisp. Soft bread turns to mush under avocado.', durationSec: 180, check: 'Rigid when you lift a slice by one corner.' },
      { title: 'Ripe or not?', detail: 'A ripe avocado gives slightly when you press near the stem. If it is hard, slice it thin instead of mashing, and it will still work.', durationSec: 60 },
      { title: 'Season the avocado properly', detail: 'Mash with salt, pepper and lemon or vinegar. Avocado without acid tastes flat — this is the step people skip.', durationSec: 90 },
      { title: 'Build', detail: 'Avocado first, then tomato, then chilli or egg. Season the tomato separately.', durationSec: 60 },
    ],
  },
  {
    name: 'Samp and beans with spinach',
    tagline: 'Slow, but you can leave it alone',
    cuisine: 'South African',
    minutes: 90,
    difficulty: 'easy',
    servings: 6,
    core: ['samp'],
    optional: ['kidney beans', 'spinach', 'onion', 'butter', 'stock cubes', 'curry powder'],
    need: ['stovetop', 'pot'],
    costZar: 35,
    method: [
      { title: 'Soak overnight if you can', detail: 'Cover with plenty of water and soak overnight. If you forgot, add 30 minutes to the cooking time.', durationSec: 120 },
      { title: 'Boil hard for 10 minutes', detail: 'Fresh water, rolling boil, 10 minutes uncovered. This is a food-safety step for dried beans, not a flavour step — do not skip it.', durationSec: 600 },
      { title: 'Simmer low and long', detail: 'Turn down, cover, and simmer 60–75 minutes. Stir from the bottom every 15 minutes so it does not catch.', durationSec: 4200, check: 'Samp is soft all the way through, not chalky in the middle.' },
      { title: 'Season and enrich', detail: 'Add a stock cube, butter and salt once the samp is soft — salting dried beans early keeps them tough.', durationSec: 120 },
      { title: 'Wilt the spinach in', detail: 'Stir spinach through in the last 3 minutes so it keeps its colour.', durationSec: 180 },
    ],
  },
  {
    name: 'Fridge-raid stir fry',
    tagline: 'Any vegetables, one pan, ten minutes',
    cuisine: 'Asian-ish',
    minutes: 18,
    difficulty: 'easy',
    servings: 3,
    core: [],
    coreAny: [['cabbage', 'carrots', 'broccoli', 'green beans', 'courgette', 'green pepper', 'mushrooms', 'peas', 'mixed vegetables', 'spinach']],
    optional: ['onion', 'garlic', 'ginger', 'soy sauce', 'rice', 'noodles', 'eggs', 'chicken', 'honey', 'chilli'],
    need: ['stovetop', 'frying pan'],
    costZar: 38,
    method: [
      { title: 'Cut everything the same size', detail: 'Whatever shape you choose, keep it uniform so it cooks at the same rate. Have it all ready before the pan goes on.', durationSec: 420 },
      { title: 'Hot pan, small batches', detail: 'The pan must be hot enough that a drop of water evaporates on contact. Fry in two batches if the pan is crowded — a crowded pan steams.', durationSec: 120, check: 'Water droplet vanishes immediately.' },
      { title: 'Hard vegetables first', detail: 'Carrot, broccoli stems, cabbage core for 3 minutes, then softer vegetables for 2 more. Keep everything moving.', durationSec: 300 },
      { title: 'Sauce around the edge', detail: 'Pour soy sauce around the rim of the pan, not into the middle. It hits hot metal and caramelises instead of just going soggy.', durationSec: 60, tip: 'A teaspoon of honey or sugar balances the salt.' },
      { title: 'Finish', detail: 'Serve over rice or noodles, or crack an egg into it and stir hard for the last 30 seconds.', durationSec: 120 },
    ],
  },
  {
    name: 'Butternut soup',
    tagline: 'Sweet, cheap, freezes well',
    cuisine: 'Home cooking',
    minutes: 40,
    difficulty: 'easy',
    servings: 5,
    core: ['butternut'],
    optional: ['onion', 'garlic', 'stock cubes', 'cream', 'milk', 'curry powder', 'ginger', 'bread', 'cinnamon'],
    need: ['stovetop', 'pot'],
    costZar: 40,
    method: [
      { title: 'Roast for sweetness (optional)', detail: 'If you have an oven, roast the cubes at 200 °C for 25 minutes first. Roasting turns the sugars and it tastes noticeably better than boiling.', durationSec: 1500, tip: 'No oven? Boiling is fine, just add a teaspoon of sugar.' },
      { title: 'Soften the aromatics', detail: 'Onion in butter for 6 minutes, then garlic, ginger and a teaspoon of curry powder for 1 minute.', durationSec: 420 },
      { title: 'Simmer', detail: 'Add the butternut and enough stock to cover by 2 cm. Simmer 20 minutes until it crushes against the side of the pot.', durationSec: 1200, check: 'Falls apart under light pressure from a spoon.' },
      { title: 'Blend carefully', detail: 'Off the heat, blend in batches and never fill the jug more than half. Hot liquid expands violently when blended.', durationSec: 300, tip: 'A stick blender straight in the pot is safest.' },
      { title: 'Finish', detail: 'A splash of cream or milk, salt, and a pinch of cinnamon. Taste again after the dairy goes in — it usually needs more salt.', durationSec: 120 },
    ],
  },
  {
    name: 'Wire-free sandwich tower',
    tagline: 'No heat at all — for load shedding',
    cuisine: 'No-cook',
    minutes: 7,
    difficulty: 'easy',
    servings: 1,
    core: ['bread'],
    coreAny: [['cheese', 'polony', 'tinned tuna', 'avocado', 'peanut butter', 'jam', 'banana', 'eggs', 'tomatoes']],
    optional: ['lettuce', 'cucumber', 'mayonnaise', 'tomatoes', 'onion', 'cabbage'],
    need: ['no cooking'],
    costZar: 20,
    method: [
      { title: 'Build on a dry surface', detail: 'Mayonnaise or butter on both slices stops the bread going soggy from the tomato.', durationSec: 60 },
      { title: 'Season the vegetables', detail: 'Salt and pepper the tomato and cucumber slices on their own before they go in — otherwise they taste watery inside the sandwich.', durationSec: 90 },
      { title: 'Order matters', detail: 'Wet things in the middle, protected by cheese or meat on both sides.', durationSec: 60 },
      { title: 'Press and cut', detail: 'Press gently, then cut on the diagonal. It genuinely tastes better and it holds together when you bite it.', durationSec: 60 },
    ],
  },
]

export interface MealOptions {
  /** canonical ingredient names the user has */
  have: string[]
  /** things they must avoid / do not have */
  missing?: string[]
  equipment: string[]
  budget?: number
  noCook?: boolean
  maxMinutes?: number
}

export interface MealMatch {
  template: RecipeTemplate
  haveAll: string[]
  missingCore: string[]
  score: number
}

function equipmentOk(t: RecipeTemplate, equipment: string[]) {
  if (!equipment.length) return true
  if (equipment.includes('no cooking')) return t.need.includes('no cooking')
  const has = (need: string) => equipment.some((e) => e === need || (need === 'frying pan' && e === 'pot') || (need === 'pot' && e === 'frying pan'))
  return t.need.every((n) => n === 'no cooking' || has(n))
}

/** Rank the recipes that best fit what the user actually has. */
export function matchRecipes(opts: MealOptions): MealMatch[] {
  const have = opts.have
  const missing = (opts.missing ?? []).filter((m) => !['oven', 'stovetop', 'microwave', 'electricity'].includes(m))
  const equipment = opts.equipment
  const noCook = opts.noCook || equipment.includes('no cooking')

  const out: MealMatch[] = []
  for (const t of RECIPES) {
    if (noCook && !t.need.includes('no cooking')) continue
    if (opts.maxMinutes && t.minutes > opts.maxMinutes) continue

    const required = new Set(t.core)
    const anyGroups = t.coreAny ?? []
    const haveAll: string[] = []
    const missingCore: string[] = []

    for (const item of required) {
      if (have.some((h) => sameIngredient(h, item))) haveAll.push(item)
      else if (missing.some((m) => sameIngredient(m, item))) missingCore.push(item)
      else missingCore.push(item)
    }
    for (const group of anyGroups) {
      const hit = group.find((g) => have.some((h) => sameIngredient(h, g)))
      if (hit) haveAll.push(hit)
      else missingCore.push(group.slice(0, 2).join(' or '))
    }

    // Equipment mismatch is a soft penalty rather than an exclusion, so the user
    // still sees the dish and can ask for a stovetop version.
    const eqOk = equipmentOk(t, equipment)
    const eqPenalty = eqOk ? 0 : 0.55

    const total = required.size + anyGroups.length
    const coverage = total === 0 ? 0.6 : haveAll.length / total

    const extras = (t.optional ?? []).filter((o) => have.some((h) => sameIngredient(h, o))).length
    const extraBonus = Math.min(0.18, extras * 0.03)

    const budgetPenalty =
      opts.budget && t.costZar && t.costZar > opts.budget ? Math.min(0.3, (t.costZar - opts.budget) / opts.budget) : 0

    const simplicity = t.minutes <= 20 ? 0.1 : t.minutes <= 35 ? 0.05 : 0
    const missingPenalty = missingCore.length * 0.18

    const score = Math.max(
      0,
      Math.min(1, coverage * 0.75 + extraBonus + simplicity - eqPenalty - budgetPenalty - missingPenalty),
    )
    out.push({ template: t, haveAll, missingCore, score: Math.round(score * 100) / 100 })
  }

  return out.sort((a, b) => b.score - a.score)
}

/** Turn a template into a full Recipe with the user's missing items handled. */
export function materialiseRecipe(
  match: MealMatch,
  opts: { have: string[]; missing?: string[]; equipment: string[]; servings?: number },
): Recipe {
  const t = match.template
  const missing = opts.missing ?? []
  const servings = opts.servings ?? t.servings

  const ingredients = [
    ...t.core.map((item) => ({ item, have: true, optional: false })),
    ...(t.coreAny ?? []).map((group) => {
      const hit = group.find((g) => opts.have.some((h) => sameIngredient(h, g)))
      return { item: hit ?? group[0], have: Boolean(hit), optional: false }
    }),
    ...(t.optional ?? []).map((item) => ({
      item,
      have: opts.have.some((h) => sameIngredient(h, item)),
      optional: true,
    })),
  ].filter((ing, i, arr) => arr.findIndex((x) => x.item === ing.item) === i)

  const equipment = t.need.filter((n) => n !== 'no cooking')
  const missingEquipment = equipment.filter((n) => !opts.equipment.some((e) => e === n))

  const steps: Step[] = t.method.map((m, i) => ({
    n: i + 1,
    title: m.title,
    detail: m.detail,
    durationSec: m.durationSec,
    check: m.check,
    tip: m.tip,
    tools: [],
    annotationIds: [],
    risk: t.core.includes('chicken') || t.core.includes('beef mince') ? ('low' as const) : ('none' as const),
    voice: m.title + '.',
    diagram: m.diagram,
  }))

  const missingList = [
    ...match.missingCore,
    ...missingEquipment.map((e) => `${e} (equipment)`),
  ]

  // Optional ingredients the user lacks. The dish still works without them, so they
  // are reported separately rather than as blockers — but they are worth mentioning,
  // because an omelette with nothing in it is a thin meal.
  const niceToHave = (t.optional ?? []).filter(
    (item) => !opts.have.some((h) => sameIngredient(h, item)) && !missingList.some((m) => sameIngredient(m, item)),
  )

  return {
    name: t.name,
    tagline: t.tagline,
    cuisine: t.cuisine,
    minutes: t.minutes,
    difficulty: t.difficulty,
    servings,
    ingredients,
    usesWhatYouHave: match.haveAll,
    missing: missingList,
    niceToHave,
    equipment,
    steps,
    notes: missing.length
      ? `Adjusted for what you told me you don't have: ${missing.join(', ')}.`
      : undefined,
    costZar: t.costZar,
  }
}

/** Rough cost estimate for a list of pantry items. Clearly an estimate. */
export function estimateCost(items: string[]): { total: number; lines: { item: string; cost: number }[] } {
  const lines: { item: string; cost: number }[] = []
  let total = 0
  for (const item of items) {
    const hit = PANTRY.find((p) => sameIngredient(p.name, item))
    const cost = hit?.cost ?? 25
    lines.push({ item, cost })
    total += cost
  }
  return { total, lines }
}

/** What is cheap right now in season, roughly, for a South African kitchen. */
export const SEASONAL_HINTS = [
  'Cabbage, butternut, carrots and potatoes are the cheapest vegetables in most months here.',
  'Dried beans, lentils, samp, rice and maize meal are the cheapest protein and starch per meal by a wide margin.',
  'Buying mince, chicken and wors in a larger pack and splitting it at home usually beats buying small packs.',
]
