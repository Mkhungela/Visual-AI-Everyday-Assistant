/**
 * Curated scenarios for the offline engine.
 *
 * When no AI key is configured the app still has to give a genuinely useful answer
 * for the most common situations. These are hand-written, not generated: real steps,
 * real checks, real safety positions, real local context.
 *
 * They are selected by keyword overlap with what the user typed or said, plus a rough
 * on-device read of the image. The UI always labels demo output as demo output.
 */

import type {
  Annotation,
  FollowUpQuestion,
  IdentifyInfo,
  KnowledgeNote,
  RiskLevel,
  SafetyFlag,
  SoftwareInfo,
  Step,
  TaskMode,
  TroubleshootInfo,
} from '../schema'

export interface MiniStep {
  title: string
  detail: string
  why?: string
  tip?: string
  check?: string
  durationSec?: number
  risk?: RiskLevel
  diagram?: Step['diagram']
}

export function toSteps(list: MiniStep[]): Step[] {
  return list.map((s, i) => ({
    n: i + 1,
    title: s.title,
    detail: s.detail,
    why: s.why,
    tip: s.tip,
    check: s.check,
    durationSec: s.durationSec,
    risk: s.risk ?? 'none',
    tools: [],
    annotationIds: [],
    voice: s.title + (s.detail ? '. ' + s.detail.split('. ')[0] + '.' : '.'),
    diagram: s.diagram,
  }))
}

export function safety(
  hazard: SafetyFlag['hazard'],
  level: RiskLevel,
  message: string,
  precaution?: string,
  opts: { stop?: boolean; escalate?: boolean } = {},
): SafetyFlag {
  return {
    id: `s_${hazard}_${Math.random().toString(36).slice(2, 6)}`,
    hazard,
    level,
    message,
    precaution,
    stop: opts.stop ?? false,
    escalate: opts.escalate ?? false,
  }
}

export interface Scenario {
  id: string
  intent: TaskMode
  /** keyword triggers, lower-cased */
  triggers: string[]
  /** rough visual categories this fits, from the on-device image read */
  categories: ('food' | 'appliance' | 'vehicle' | 'tool' | 'screen' | 'document' | 'plant' | 'clothing' | 'room' | 'unknown')[]
  title: string
  situation: string
  sceneSummary: string
  summary: string
  objects: string[]
  tools: string[]
  materials: string[]
  safety: SafetyFlag[]
  steps: MiniStep[]
  followUps?: FollowUpQuestion[]
  identify?: IdentifyInfo
  troubleshoot?: TroubleshootInfo
  software?: SoftwareInfo
  knowledge?: KnowledgeNote[]
  askMeNext?: string[]
  videos?: { title: string; query: string; why: string }[]
  /** answers to likely follow-up questions, matched by keyword */
  answers?: { match: string[]; reply: string }[]
}

export const SCENARIOS: Scenario[] = [
  /* ------------------------------------------------------------------ laundry */
  {
    id: 'washing-machine',
    intent: 'use',
    triggers: ['washing machine', 'washer', 'wash', 'laundry', 'spin cycle', 'drum', 'cold wash', 'delicate', 'blanket', 'duvet'],
    categories: ['appliance'],
    title: 'Wash a mixed load without ruining anything',
    situation: 'A front-loader washing machine with clothes you want to wash.',
    sceneSummary: 'A washing machine control panel with a dial, a small display and several buttons.',
    summary:
      'Most washing machine panels do the same four things: choose a programme, set the temperature, choose a spin speed, then start. Everything else is optional. I will walk you through a normal everyday load, and then how to change it for delicates or bedding.',
    objects: ['Washing machine'],
    tools: [],
    materials: ['Detergent', 'Fabric softener (optional)'],
    safety: [
      safety('electricity', 'medium', 'Never open the door mid-cycle on a front loader — there is water above the seal.', 'Wait for the door lock light to go off before pulling the handle.', { stop: false }),
      safety('water', 'low', 'Check the inlet hose behind the machine now and then for bulging or damp patches.', 'A bulging hose is a burst waiting to happen; replace it rather than tightening it.'),
    ],
    steps: [
      {
        title: 'Sort the load',
        detail: 'Split into two piles: whites and lights in one, dark and bright colours in the other. Check every pocket — a tissue will cover the whole load in lint, and a coin will rattle in the drum.',
        check: 'Pockets empty, no red sock in with the white towels.',
        durationSec: 120,
        tip: 'New dark jeans: wash separately the first two times. They bleed a lot.',
      },
      {
        title: 'Put the detergent in the right compartment',
        detail: 'On a front loader, detergent goes in the drawer at the top left — the compartment marked with a flower or the Roman numeral II. The smaller compartment with a star or I is for pre-wash, and the one with a flower-in-a-cup is fabric softener. Softener must never go in with the detergent.',
        why: 'Softener in the main wash compartment strips the detergent and leaves greasy marks on the clothes.',
        check: 'Powder in the compartment with the flower; softener in the one with the cup symbol.',
        durationSec: 90,
        diagram: { label: 'Detergent drawer', position: 'tl', kind: 'drawer' },
      },
      {
        title: 'Load and close',
        detail: 'Fill the drum loosely — a hand should fit flat between the clothes and the top of the drum. Overloading is the single most common cause of a machine that "does not rinse properly". Close the door firmly until it clicks.',
        check: 'You can press the clothes down with a flat palm and they spring back.',
        durationSec: 120,
      },
      {
        title: 'Choose the programme',
        detail: 'Turn the dial to Cotton or Everyday (usually the first position). For anything you are unsure of, choose Synthetics or Easy Care — it uses more water and gentler agitation.',
        check: 'Display shows a washing time in minutes.',
        durationSec: 60,
        diagram: { label: 'Programme dial', position: 'mc', kind: 'dial' },
      },
      {
        title: 'Set the temperature',
        detail: '30 °C is right for almost everything and is the best balance of cleaning and not shrinking. Go to 40 °C for towels, sheets and underwear. Only go to 60 °C for genuinely soiled whites or when someone in the house is ill.',
        why: 'Above 40 °C, most dark dyes start to fade and stretch fabrics lose their shape.',
        check: 'Display reads 30 or 40, not 60.',
        durationSec: 60,
        diagram: { label: 'Temperature button', position: 'mr', kind: 'button' },
      },
      {
        title: 'Set the spin speed',
        detail: '1200 rpm for cotton towels and sheets, 800 for everyday clothes, 600 or lower for anything with elastane, wool or a delicate weave. Higher spin means less drying time but more creasing.',
        check: 'Display shows the rpm figure.',
        durationSec: 45,
        diagram: { label: 'Spin button', position: 'br', kind: 'button' },
      },
      {
        title: 'Start it',
        detail: 'Press the button marked Start or the play symbol. On most machines this is also the pause button if you press it again. You should hear the door lock click and the drum turn slowly to weigh the load.',
        check: 'Door lock light on, water running in within 60 seconds.',
        durationSec: 30,
        diagram: { label: 'Start / Pause', position: 'bc', kind: 'button' },
      },
      {
        title: 'Unload promptly',
        detail: 'Take clothes out as soon as the cycle finishes. Leaving a wet load in the drum for an hour is what makes that musty smell that people blame on the machine.',
        check: 'Drum empty and door left ajar to dry.',
        durationSec: 240,
        tip: 'Leave the door and the detergent drawer slightly open between washes — it prevents the smell entirely.',
      },
    ],
    followUps: [
      { id: 'q1', question: 'Is it a top-loader or a front-loader?', kind: 'choice', options: ['Front-loader (door in front)', 'Top-loader (lid on top)'], why: 'Detergent placement and door safety are different.', important: true },
      { id: 'q2', question: 'What are you washing?', kind: 'choice', options: ['Everyday clothes', 'Towels and bedding', 'Delicates or wool', 'Work clothes or stains'], why: 'The programme and temperature change completely.', important: true },
      { id: 'q3', question: 'Powder or liquid detergent?', kind: 'choice', options: ['Powder', 'Liquid', 'Pods'], why: 'Pods go in the drum, not the drawer.', important: false },
    ],
    askMeNext: ['What do I do next?', 'How do I wash a blanket?', 'It smells musty after washing', 'What does the symbol on the dial mean?'],
    videos: [
      { title: 'Washing machine basics for a front loader', query: 'how to use a front loader washing machine programme temperature spin', why: 'Shows the same panel layout and the same order of operations.' },
      { title: 'Washing a duvet or blanket at home', query: 'how to wash a duvet in a washing machine without ruining it', why: 'Blankets need a different load size and spin speed.' },
    ],
    answers: [
      { match: ['musty', 'smell', 'smells', 'stink'], reply: 'That smell is almost always biofilm in the detergent drawer and the door seal, not the drum. Pull the drawer right out — there is a clip you press in the centre — and scrub it with hot water and vinegar. Then wipe inside the rubber door seal, especially the fold at the bottom, and run one empty 90 °C cycle with a cup of vinegar in the drum. Do that once a month and it never comes back.' },
      { match: ['blanket', 'duvet', 'bedding'], reply: 'A double duvet will not physically fit a standard 7 kg machine — it absorbs water, becomes enormous and can unbalance the drum. Take it to a laundromat with a big machine, or wash it at home only if it is a thin summer-weight one, on a Synthetics 30 °C cycle at 600 rpm with half the normal detergent.' },
      { match: ['top loader', 'top-loader'], reply: 'Top loaders are different in two ways. Detergent usually goes straight into the drum or the inner basket, never the drawer — and a top loader fills by weight, so press the load down before starting so it senses properly. Never open the lid during the spin; the safety switch stops it, and forcing it damages the brake.' },
      { match: ['temperature', 'cold', 'hot', 'degrees'], reply: 'Use 30 °C for everyday clothes — it cleans well enough and protects colour and shape. 40 °C for towels, sheets and underwear because they carry more bacteria. 60 °C only for really soiled whites. A cold 20 °C wash works for lightly worn clothes, but you need a liquid detergent designed for cold water, or powder will not dissolve.' },
    ],
  },

  /* ------------------------------------------------------------------ microwave */
  {
    id: 'microwave',
    intent: 'use',
    triggers: ['microwave', 'defrost', 'warm up', 'heat up food', 'reheat'],
    categories: ['appliance'],
    title: 'Reheat and defrost safely in the microwave',
    situation: 'A microwave with a wattage setting and a timer.',
    sceneSummary: 'A microwave control panel with a numeric keypad, power button and start button.',
    summary:
      'Microwaves are almost all the same: power level, time, start. The part that catches people out is that microwave power is not the same as cooking power — 50 % is not "half as hot", it is on-and-off in bursts, which is what you want for anything that needs to heat evenly.',
    objects: ['Microwave'],
    tools: [],
    materials: ['Microwave-safe container', 'Cover or lid'],
    safety: [
      safety('fire', 'high', 'Never put metal, foil, or a twist-tie in a microwave. Thin metal edges arc and start fires.', 'If you see sparks, stop it immediately and leave the door shut for a minute before opening.', { stop: true }),
      safety('food', 'medium', 'Microwaves heat unevenly. Baby bottles and reheated leftovers can have scalding pockets.', 'Stir, then wait two minutes, then test the temperature with a finger or a spoon before feeding anyone.'),
      safety('chemical', 'medium', 'Heating water alone in a clean cup can superheat and erupt when you move it.', 'Put a wooden skewer or spoon in the cup when heating plain water.'),
    ],
    steps: [
      { title: 'Use the right container', detail: 'Glass, ceramic marked microwave-safe, or the plastic tub the food came in only if it says microwave-safe. If in doubt, use a glass bowl. Cling film should be pierced or lifted at one corner.', check: 'Container has a microwave-safe symbol or is clearly glass or ceramic.', durationSec: 45 },
      { title: 'Cover it loosely', detail: 'A plate on top, or a lid with a gap. Covering traps steam so the food heats through instead of drying at the edges — but an airtight seal will blow off.', check: 'Steam can escape at the edge.', durationSec: 20 },
      { title: 'Set the power level', detail: 'Full power for drinks and small portions. 50 % (often the "Medium" button) for anything dense — lasagne, stew, a plate of Sunday lunch. 30 % for defrosting. Power level is set before the time, and the display usually shows a percentage.', why: 'On 50 %, the magnetron runs about half the time, letting heat conduct inward between bursts. That is why dense food heats through instead of being cold in the middle.', check: 'Display shows the power percentage you chose.', durationSec: 45, diagram: { label: 'Power level', position: 'ml', kind: 'button' } },
      { title: 'Enter the time', detail: 'Drinks 1 minute. A plated meal 3–4 minutes on 50 %. Defrosting a chicken breast 4–5 minutes on 30 %, turning halfway. Frozen meals follow the packet — but add time rather than power if it needs more.', check: 'Timer shows your time, not the clock.', durationSec: 45, diagram: { label: 'Time keypad', position: 'mc', kind: 'display' } },
      { title: 'Start, then check halfway', detail: 'Press Start. At the halfway point, open the door, stir or turn the food, and put it back. Opening the door pauses it — nothing is lost.', check: 'Food is steaming and the container is hot to the touch.', durationSec: 240, diagram: { label: 'Start', position: 'br', kind: 'button' } },
      { title: 'Rest before eating', detail: 'Leave it 2 minutes. The temperature equalises in that time — this is a food-safety step, not a nicety, especially for meat and rice.', check: 'Cut into the thickest part of the food: steaming all the way through, not cold in the middle.', durationSec: 120, tip: 'Reheated rice: heat it until it is steaming hot all the way through and eat it within an hour. Cooked rice left warm is a genuine food-poisoning risk.' },
    ],
    followUps: [
      { id: 'q1', question: 'What are you heating?', kind: 'choice', options: ['A drink', 'A plated meal', 'Frozen food', 'Defrosting meat'], why: 'Power level and time are completely different for each.', important: true },
      { id: 'q2', question: 'Does your microwave have a power level button?', kind: 'yes_no', options: ['Yes', 'No'], why: 'Some models only offer a few preset buttons.', important: true },
    ],
    askMeNext: ['It is not heating at all', 'What time for a cup of tea?', 'Can I put this container in?'],
    answers: [
      { match: ['not heating', 'doesn', 'broken', 'no power'], reply: 'First the obvious, in order: is the plug firmly in, is the socket working (test it with a phone charger), and has the door switch failed — if the light comes on but nothing heats, that is usually a door interlock. If the light and turntable work but the food stays cold, the magnetron or its fuse has failed. That is not a DIY repair: microwave internals hold a lethal charge even unplugged. Replace it.' },
      { match: ['container', 'plastic', 'safe'], reply: 'Look for the microwave-safe symbol (a wave symbol inside a square) or the words "microwave safe". No symbol means no. Never use any metal, gold-rimmed plates, or thin takeaway containers you are not sure about — and if a container gets soft or warped in the microwave, stop using it for food immediately.' },
    ],
  },

  /* ------------------------------------------------------------------ vehicle */
  {
    id: 'dashboard-warning',
    intent: 'safety',
    triggers: ['warning light', 'dashboard', 'dash', 'engine light', 'check engine', 'oil light', 'battery light', 'abs light', 'temperature gauge', 'light came on', 'symbol'],
    categories: ['vehicle'],
    title: 'Work out what a dashboard warning is telling you',
    situation: 'A dashboard warning light you want to understand.',
    sceneSummary: 'An instrument cluster with several illuminated indicator symbols.',
    summary:
      'Dashboard colours are a scale, not decoration. Green and blue mean something is on or working. Amber means investigate soon. Red means stop safely as soon as you can and check before driving further. Tell me the colour and the shape and I can narrow it down — but I cannot diagnose a fault from a photo, and I will not pretend otherwise.',
    objects: ['Dashboard instrument cluster'],
    tools: ['Owner’s manual (the fastest answer for your exact car)'],
    materials: [],
    safety: [
      safety('vehicle', 'high', 'A red warning light means stop safely, not "drive home and check later".', 'Pull over where it is safe, switch off the engine, and check the driver’s manual before continuing.', { escalate: true }),
      safety('vehicle', 'critical', 'Oil pressure and brake warning lights can mean imminent engine damage or brake failure.', 'Do not continue driving. Have the vehicle recovered rather than driven.', { stop: false, escalate: true }),
      safety('machinery', 'high', 'Never open a radiator cap or coolant reservoir while the engine is hot.', 'Scalding coolant sprays under pressure. Wait at least 30 minutes with the engine off, then release the cap slowly with a cloth.'),
    ],
    steps: [
      { title: 'Note the colour', detail: 'Red means stop. Amber or orange means get it looked at soon. Green or blue means a system is simply switched on. This one distinction decides everything that follows.', check: 'Colour noted.', durationSec: 30 },
      { title: 'Match the shape to the common ones', detail: 'Battery rectangle with + and −: charging system. Oil can with a drip: oil pressure. Thermometer in liquid: overheating. Engine outline: engine management. Exclamation mark in a circle: brake system or handbrake. Pac-man with an exclamation mark: tyre pressure. Steering wheel with an exclamation mark: power steering.', check: 'You have a shape and a colour.', durationSec: 60, tip: 'Your owner’s manual has the exact set for your car, usually in the first ten pages of the instruments section.' },
      { title: 'Do the safe immediate check', detail: 'On a cold engine only: check the oil level on the dipstick, check coolant level in the reservoir (look through the plastic, do not open it), and check that the handbrake is fully down. Those three explain a large share of red lights.', check: 'Oil between the marks, coolant above MIN, handbrake down.', durationSec: 300, tip: 'If the light goes out when the handbrake is released, that was it. Nothing more to do.', risk: 'medium' },
      { title: 'Decide: continue or stop', detail: 'Red and still on with the engine running: stop and get help. Amber and the car drives normally: you can drive gently to a workshop, avoiding hard acceleration. Amber and the car is driving badly — misfiring, no power, rough idle — stop.', check: 'You have made a stop/continue decision.', durationSec: 120 },
      { title: 'Get it read properly', detail: 'Amber engine-management lights store a fault code. Any workshop with an OBD2 reader — often for free at an auto parts store — will read the exact code in two minutes. That removes the guesswork entirely.', check: 'You have a fault code, not a guess.', durationSec: 60 },
    ],
    followUps: [
      { id: 'q1', question: 'What colour is the light?', kind: 'choice', options: ['Red', 'Amber / orange / yellow', 'Green', 'Blue'], why: 'Colour determines urgency more than the symbol does.', important: true },
      { id: 'q2', question: 'Is the engine still running normally?', kind: 'yes_no', options: ['Yes', 'No'], why: 'Rough running with a warning light changes the advice.', important: true },
      { id: 'q3', question: 'Is the light steady or flashing?', kind: 'choice', options: ['Steady', 'Flashing'], why: 'A flashing engine light means an active misfire that can destroy the catalytic converter.', important: true },
    ],
    askMeNext: ['What does this symbol mean?', 'Can I keep driving?', 'How do I check my oil?'],
    knowledge: [
      { claim: 'A flashing engine-management light is more urgent than a steady one.', why: 'Flashing usually indicates an active misfire, which dumps unburnt fuel into the catalytic converter and can destroy it within minutes of driving.', confidence: 'high' },
      { claim: 'A tyre-pressure light can come on from a big temperature drop, not only a puncture.', why: 'Tyre pressure falls roughly 1 psi for every 5 °C drop in ambient temperature. Check pressures cold, before driving.', confidence: 'high' },
    ],
    videos: [
      { title: 'Reading your dashboard warning lights', query: 'dashboard warning lights explained what each symbol means', why: 'A visual walkthrough of the symbols.' },
    ],
    answers: [
      { match: ['keep driving', 'can i drive', 'safe to drive'], reply: 'Rule of thumb: red light means do not keep driving. Amber light means you may drive gently to a workshop, but not on a long trip. Amber plus the car running badly means stop. If you are on a highway, get off at the next exit rather than stopping on the shoulder.' },
      { match: ['resets', 'reset', 'went away', 'cleared'], reply: 'Lights that come on and then go away on their own are usually intermittent sensor faults — and the fault code stays stored even after the light goes out, so a reader will still find it. Do not treat a self-clearing light as "fixed". Get the code read; it is cheap and it tells you whether you are looking at a R300 sensor or an R8000 problem.' },
    ],
  },
  {
    id: 'tyre-change',
    intent: 'fix',
    triggers: ['tyre', 'tire', 'flat', 'puncture', 'spare wheel', 'jack', 'wheel nuts', 'wheel brace', 'changed a tyre'],
    categories: ['vehicle'],
    title: 'Change a wheel safely at the roadside',
    situation: 'A vehicle with a flat tyre that needs changing.',
    sceneSummary: 'A vehicle wheel with a deflated tyre.',
    summary:
      'This is the one job where doing it in the wrong order genuinely kills people. The carrying order matters more than the strength: loosen the nuts before you lift, and never put any part of your body under a car held up only by a jack.',
    objects: ['Wheel', 'Vehicle'],
    tools: ['Jack', 'Wheel brace or spanner', 'Spare wheel', 'Wheel chocks or a brick', 'Reflective triangle or hazard lights'],
    materials: [],
    safety: [
      safety('vehicle', 'critical', 'A jack is for lifting only. It is not designed to hold a car up while you work under it.', 'Never put your hands, feet or body under the vehicle. The wheel off the ground is the only thing you touch.', { stop: false, escalate: false }),
      safety('vehicle', 'high', 'Changing a wheel on a live traffic lane, or on a soft shoulder, is a leading cause of roadside deaths.', 'Get the car as far off the road as you can, on firm level ground, and put your hazards and triangle out BEFORE you start.', { stop: false }),
      safety('sharp', 'medium', 'A jack can slip sideways on gravel, tar with a slope, or wet grass.', 'Find firm level ground. If you cannot, do not jack it — call for recovery.'),
      safety('vehicle', 'medium', 'If the vehicle has a locking wheel nut and you do not have the key, you cannot remove the wheel at all.', 'Check for a locking nut before you dismantle anything.'),
    ],
    steps: [
      { title: 'Get safe before you get the jack out', detail: 'Pull as far onto the shoulder as you can, on the flattest ground available. Apply the handbrake hard. Put the car in gear, or in Park for an automatic. Switch on hazards and put a triangle out behind you — 30 m on a normal road.', why: 'Almost every roadside injury happens before the wheel work starts.', check: 'Handbrake on, in gear, hazards flashing, triangle out.', durationSec: 300, risk: 'high' },
      { title: 'Loosen the nuts a quarter turn', detail: 'WITH THE CAR STILL ON THE GROUND, fit the wheel brace and loosen each nut about a quarter turn. Push down on the end of the brace, do not pull up, and keep your back straight. If a nut is seized, stand on the brace end with your body weight — it is designed for that.', why: 'Once the wheel is in the air it will simply spin, and you will have no leverage at all.', check: 'Every nut has moved fractionally.', durationSec: 300, risk: 'medium', tip: 'Some vehicles have a cover or hubcap held by two clips. Prise it off before you start.' },
      { title: 'Chock the opposite wheel', detail: 'Put a brick, stone or the spare wheel flat against the wheel diagonally opposite the one you are lifting. If you are lifting a front wheel, chock a rear wheel.', check: 'Wheel cannot roll that direction.', durationSec: 60 },
      { title: 'Raise the vehicle on the jacking point', detail: 'Find the reinforced lip with the notch or arrow underneath the sill, within about 30 cm of the wheel you are changing — not the middle of the car, and never the plastic sill cover. Fit the jack under that point and lift until the wheel is 2–3 cm clear of the ground.', why: 'Jacking anywhere else, especially on the floor pan, crushes metal and drops the car.', check: 'Jack is seated in the notch, tyre is clear of the ground by a couple of centimetres.', durationSec: 300, risk: 'high', tip: 'Don’t get under the car. Not a hand, not a foot, not to look.' },
      { title: 'Replace any part of your body with the spare wheel', detail: 'Slide the spare wheel flat under the sill, next to the jack, as soon as it is free. If the jack fails, the car lands on the wheel instead of on you. This costs you five seconds.', check: 'Wheel is under the sill before you remove the old wheel.', durationSec: 90, risk: 'critical' },
      { title: 'Take the nuts off and swap the wheel', detail: 'Fully remove the nuts into a container — not your pocket and not the road. Pull the wheel straight off. Lift the new wheel on with both hands, aligning the holes with the studs, and hold it in place with one hand while you fit two nuts by hand.', check: 'Two nuts finger-tight and the wheel flush against the hub.', durationSec: 300, risk: 'medium' },
      { title: 'Lower it, then tighten in a star pattern', detail: 'Lower the jack until the tyre just touches the ground, so the wheel cannot spin but the weight is still mostly off it. Tighten the nuts by hand in a star pattern — never in a circle — then lower fully and do a final tighten with the brace.', why: 'A star pattern seats the wheel evenly. Tightening around the circle warps the disc and can crack a wheel.', check: 'Every nut tight, and the wheel sits flush with no wobble.', durationSec: 300, risk: 'medium' },
      { title: 'Check the pressure and re-torque soon', detail: 'A space-saver spare is usually rated to about 80 km/h and roughly 80 km range — read the sidewall. Get the nuts re-torqued at a garage within 50 km, and get the damaged tyre assessed the same day. Many punctures are repairable if you do not drive on them flat.', check: 'Pressure checked, plan made for the damaged tyre.', durationSec: 300 },
    ],
    followUps: [
      { id: 'q1', question: 'Do you have a spare wheel in the boot?', kind: 'yes_no', options: ['Yes', 'No'], why: 'No spare changes this completely — you need a plug kit or recovery.', important: true },
      { id: 'q2', question: 'Is the ground firm and level?', kind: 'yes_no', options: ['Yes', 'No, it is a slope or soft'], why: 'A jack on unstable ground is the most dangerous version of this job.', important: true },
    ],
    askMeNext: ['What do I do next?', 'It is a space-saver spare, how fast can I go?', 'There is no jack in the car'],
    answers: [
      { match: ['space saver', 'space-saver', 'speed', 'how fast'], reply: 'Space-saver spares are usually limited to 80 km/h and about 80 km of driving, and they are marked on the sidewall. They have far less grip, especially in the wet, and they affect braking. Get to a tyre shop the same day. Also check the pressure in the spare — spares lose pressure sitting in a boot for years, which is why they are often flat when you finally need them.' },
      { match: ['no jack', 'no spare', 'nothing'], reply: 'Without a jack and brace you cannot do this safely, and improvising with bricks or a scissor jack from another car is a real injury risk. Two honest options: a tyre plug kit if the puncture is a clean nail hole in the tread, or roadside recovery. If your car has no spare (many newer cars come with a sealant kit instead) use the sealant — it will get you to a garage, but it writes off the tyre, so only use it if the tyre is going to be replaced anyway.' },
      { match: ['which way', 'clockwise', 'direction', 'loose', 'tight'], reply: 'Nuts loosen anticlockwise on almost all cars — "lefty loosey". The exception is some older or heavy vehicles with left-hand-threaded studs on one side, which are usually marked with an L on the stud. When tightening, do it in a star or cross pattern rather than around in a circle.' },
    ],
  },

  /* ------------------------------------------------------------------ troubleshooting */
  {
    id: 'printer',
    intent: 'troubleshoot',
    triggers: ['printer', 'printing', 'paper jam', 'print job', 'cartridge', 'toner', 'will not print'],
    categories: ['appliance'],
    title: 'Find out why the printer is not printing',
    situation: 'A printer that is not producing prints.',
    sceneSummary: 'A desktop printer with a paper tray and a control panel with indicator lights.',
    summary:
      'Printers have a short list of things that actually go wrong, and almost all of them happen in the same order. Rather than guess, I will ask you three questions and we will eliminate the cheap, common causes first.',
    objects: ['Printer'],
    tools: [],
    materials: [],
    safety: [safety('electricity', 'low', 'Unplug the printer before reaching inside for a jammed sheet.', 'The fuser inside gets to around 200 °C and stays hot for minutes after printing.')],
    steps: [
      { title: 'Check it is actually on and awake', detail: 'Look for a green or blue power light and listen for the fan. A printer in deep sleep can look off. Press the power button once and wait 30 seconds.', check: 'Power light steady, and the head or drum moves.', durationSec: 60 },
      { title: 'Read the panel, then the screen', detail: 'A flashing amber or orange light usually means a specific fault the screen will name: paper jam, no paper, cover open, or a cartridge problem. If there is a screen, read the exact words and tell me.', check: 'You have the exact message or the light pattern.', durationSec: 60, diagram: { label: 'Status lights', position: 'tr', kind: 'display' } },
      { title: 'Look for a jam you cannot see', detail: 'Open the front and rear covers and check the whole paper path, not just the visible part. A torn corner left behind from an earlier jam is the most common cause of "it jams every time now". Pull paper in the direction it moves, never backwards.', check: 'Paper path completely clear, including behind the drum or toner unit.', durationSec: 240, tip: 'Tweezers and a torch help. Do not use anything metal near the drum.', risk: 'low' },
      { title: 'Check the computer side', detail: 'Open the print queue and look for a stuck job — a paused or errored document blocks everything behind it. Cancel all documents, then print a test page from the printer’s own menu. If the self-test prints, the printer is fine and the problem is the computer or the network.', why: 'This single step splits the problem in half: printer hardware or computer connection.', check: 'Test page printed from the printer’s menu.', durationSec: 180 },
      { title: 'Check the connection honestly', detail: 'USB: try another port and another cable — cables fail more often than people think. Wi-Fi: check the printer is on the same network as the computer, not the guest network, and not connected to a 5 GHz band if it only supports 2.4 GHz. The printer’s display usually shows its IP address; if it says 0.0.0.0 it is not on the network.', check: 'Printer shows a real IP address, or the USB connection is detected.', durationSec: 240 },
      { title: 'Restart everything once, properly', detail: 'Turn the printer off at the wall for 30 seconds, restart the computer, and delete and re-add the printer if it still fails. Reinstalling the manufacturer’s own driver fixes more stubborn cases than anything else.', check: 'Test page prints from the computer.', durationSec: 420 },
    ],
    followUps: [
      { id: 'q1', question: 'Is the printer switched on?', kind: 'yes_no', options: ['Yes', 'No'], why: 'Cheapest cause first.', important: true },
      { id: 'q2', question: 'Is there paper in the tray?', kind: 'yes_no', options: ['Yes', 'No'], why: 'The tray can look full while the pickup roller misses.', important: true },
      { id: 'q3', question: 'Does the printer show an error message or a flashing light?', kind: 'choice', options: ['A message on screen', 'A flashing light', 'Nothing — it looks normal'], why: 'The message usually names the exact fault.', important: true },
    ],
    troubleshoot: {
      system: 'Printer',
      observations: ['Printer appears powered', 'Paper tray present'],
      likelyCauses: [
        { cause: 'Paper jam in a part of the path you cannot see', likelihood: 0.3, fix: 'Open all covers and check the full path, including behind the drum for a torn corner.', diy: true },
        { cause: 'A stuck print job blocking the queue', likelihood: 0.25, fix: 'Cancel all documents and print a self-test page from the printer itself.', diy: true },
        { cause: 'Connection problem — wrong network, USB cable, or offline status', likelihood: 0.2, fix: 'Check the printer has a real IP address, or try a different USB port and cable.', diy: true },
        { cause: 'Empty or badly seated cartridge or toner', likelihood: 0.15, fix: 'Remove and reseat the cartridge. You can hear the toner rattle when shaken if there is some left.', diy: true },
        { cause: 'Driver corrupted after an update', likelihood: 0.1, fix: 'Remove the printer and reinstall the manufacturer’s driver, not the Windows generic one.', diy: true },
      ],
    },
    askMeNext: ['It says paper jam but there is no paper', 'It prints blank pages', 'It works from my phone but not my laptop'],
    answers: [
      { match: ['blank', 'nothing on the page', 'white page'], reply: 'Blank pages almost always mean the toner or ink has run out, or the protective tape is still on a new cartridge — that catches a lot of people. Pull the cartridge and shake it gently side to side; if it prints a few pages after that, it is genuinely empty and needs replacing. On an inkjet, print a nozzle check first: a blocked print head prints nothing even with a full cartridge.' },
      { match: ['paper jam', 'jams', 'jam every'], reply: 'A recurring jam at the same point with no visible paper means a torn fragment is lodged in the path. Open every cover, take out the drum or toner unit if the manual allows it, and look along the whole path with a torch — often you find a small scrap stuck to the back of the fuser. Also check the paper itself: damp paper, or a sheet stuck together, causes repeat jams at exactly the same spot.' },
    ],
  },

  /* ------------------------------------------------------------------ identify */
  {
    id: 'unidentified',
    intent: 'identify',
    triggers: ['what is this', 'whats this', "what's this", 'identify', 'unknown', 'what does this do', 'what is it'],
    categories: ['tool', 'unknown'],
    title: 'Work out what an unfamiliar object is and how to use it',
    situation: 'An object you do not recognise.',
    sceneSummary: 'A hand tool with an adjustable head and a long handle.',
    summary:
      'I cannot see your photo while running offline, so I cannot name this specific object. Tell me one or two things about it — is it metal, does it have moving parts, where did you find it — and I will narrow it down. If you add an AI key in Settings, I can identify it directly from the photo.',
    objects: ['Unidentified object'],
    tools: [],
    materials: [],
    safety: [safety('sharp', 'medium', 'Do not test an unknown tool by squeezing it hard or putting it near a power source.', 'Look for blades, springs, pressurised parts or a lead or battery terminal before handling it firmly.')],
    steps: [
      { title: 'Look for markings', detail: 'Check both sides and the handle for a brand, a model number, a European standard number (EN 60900 means insulated electrical work), a UK kitemark, or a pressure rating. A stamped number is often the fastest route to the exact answer.', check: 'Any four-character or longer alphanumeric string noted.', durationSec: 60 },
      { title: 'Work out what moves', detail: 'Turn, squeeze or slide each part gently with the object away from your face. Any joint, spring or thread tells you the tool is meant to be adjusted or that it grips something.', check: 'You know which part moves and which part does not.', durationSec: 90 },
      { title: 'Match it to a family', detail: 'Gripping (pliers, wrench, clamp): holds or turns something. Cutting (snips, shears): cuts material. Fastening (screwdriver, spanner, hex key): matches a specific fixing head. Measuring (gauge, level, tape): reads a value. Prying (bar, chisel, scraper): applies leverage. Honest answer: most tools are one of five things.', check: 'You have placed it in a family.', durationSec: 60 },
      { title: 'Check what it fits before you use it', detail: 'Never use the wrong size of tool on a fastener. A badly fitting spanner or screwdriver rounds off the head, and then nobody can shift it, not even a professional.', check: 'The tool sits fully and squarely on the fixing with no wobble.', durationSec: 60, risk: 'medium' },
      { title: 'Respect the pressure', detail: 'Anything with a valve, a gauge or a thick-walled body could hold gas or fluid under pressure. Anything with a lead or a battery terminal carries current. Both are things to leave alone until you know exactly what they are.', check: 'You know whether it holds pressure or power.', durationSec: 60, risk: 'high' },
    ],
    identify: {
      whatItIs: 'Most likely a hand tool — I need one more clue to name it confidently.',
      whatItDoes: 'Grips, turns, cuts, measures or levers something.',
      howItWorks: 'Look for the pivot or the thread: a pivot means it clamps, a thread means it adjusts to size, a fixed head means it matches one specific fixing.',
      commonMistakes: [
        'Using a metric spanner on an imperial nut, which rounds the corners',
        'Starting a nut by hand and then using the tool, instead of the tool doing everything and cross-threading it',
        'Leaving adjustable tools set loose, which damages the fastener head',
        'Using a cutting tool as a lever — the blades chip and can shatter',
      ],
      specialTools: ['The correct size and type for the fixing you are working on'],
      safetyNotes: ['Check for blades, springs or stored energy before handling firmly', 'Wear eye protection when striking or cutting anything'],
      alternatives: ['A multi-tool covers several families badly but often well enough for a one-off job'],
      actions: ['Understand it', 'Use it', 'What is it used for?', 'How do I adjust it?', 'See a demonstration'],
    },
    followUps: [
      { id: 'q1', question: 'Is it metal or plastic?', kind: 'choice', options: ['Mostly metal', 'Mostly plastic', 'Both'], why: 'Plastic-bodied tools are usually for low-force or household jobs.', important: true },
      { id: 'q2', question: 'Does it have a moving part — a joint, a spring, or a screw thread?', kind: 'yes_no', options: ['Yes', 'No'], why: 'This separates a fixed tool from an adjustable one.', important: true },
      { id: 'q3', question: 'Where did you find it?', kind: 'choice', options: ['Kitchen', 'Garage or toolbox', 'Under the sink', 'With a flat-pack or appliance'], why: 'Where it lives usually gives away what it is for.', important: false },
    ],
    askMeNext: ['How do I use it?', 'Is it safe?', 'What size do I need?'],
  },

  /* ------------------------------------------------------------------ assembly */
  {
    id: 'assembly',
    intent: 'assemble',
    triggers: ['assemble', 'assembly', 'flat pack', 'flatpack', 'put together', 'parts', 'screws', 'cupboard', 'bookshelf', 'table', 'instructions'],
    categories: ['tool'],
    title: 'Assemble flat-pack furniture without the usual mistakes',
    situation: 'Flat-pack furniture with loose parts and fixings.',
    sceneSummary: 'A collection of timber panels and a bag of screws, dowels and cam fittings.',
    summary:
      'Flat-pack furniture fails in two predictable ways: fixings are tightened in the wrong order, and pieces get turned the wrong way round. Both are avoided by laying everything out first and by only ever tightening a fitting once the whole frame is together.',
    objects: ['Flat-pack panels', 'Fixing set'],
    tools: ['Screwdriver (matching the screw head exactly)', 'Mallet or hammer with a cloth', 'Two chairs or a helper'],
    materials: ['Damp cloth', 'Extra wood glue (optional but worth it)'],
    safety: [
      safety('machinery', 'medium', 'Panels are heavy and fall easily while you are working alone.', 'Lean panels against a wall with something at the base, and get help for anything over your shoulder height.'),
      safety('structural', 'high', 'Tall bookcases and chests tip over onto children.', 'Secure the unit to the wall with the supplied strap or a bracket. This is not optional if there are children in the house.', { escalate: false }),
    ],
    steps: [
      { title: 'Sort everything before you build anything', detail: 'Lay out every panel and count every screw, dowel, cam and bolt against the parts list. Sort fixings into bowls or cups by type. Doing this now takes ten minutes and saves an hour.', why: 'Missing parts found halfway through are the number-one reason these jobs stall.', check: 'Every part on the list is present and accounted for.', durationSec: 600 },
      { title: 'Understand the cam and dowel, because it confuses everyone', detail: 'A wooden dowel goes into the edge hole and an eccentric cam goes into the round flat hole on the panel face. Turn the cam so its arrow points to the hole where the dowel will arrive, push the panels together, then turn the cam with a screwdriver to lock it around the dowel.', why: 'Turning the cam after the panels are joined, with the arrow in the wrong starting position, is what strips the fitting.', check: 'Panels pull tight together with no gap when the cam is turned.', durationSec: 300, diagram: { label: 'Cam arrow', position: 'mc', kind: 'dial' } },
      { title: 'Note which face shows', detail: 'Mark the visible faces with a scrap of masking tape or a pencil inside an edge. Most of the "wrong way round" frustration comes from a panel that was flipped, and once the frame is together it is very hard to see which piece is the culprit.', check: 'Every visible face marked.', durationSec: 300, tip: 'The smooth, laminated side usually faces out; the rougher raw side faces in.' },
      { title: 'Build loosely, in the order the manual shows', detail: 'Fit all fixings hand-tight only. Do not fully tighten a single one until the whole frame is standing square. Working in the manual’s order matters more than it looks — later pieces need earlier ones loose to slot in.', check: 'Frame stands up and the corners meet without force.', durationSec: 1800 },
      { title: 'Square it, then tighten', detail: 'Push the unit against a wall and check opposite diagonals with a tape measure — if they are equal, it is square. Only now tighten every fitting, working around the unit evenly rather than chasing one corner.', why: 'Tightening a twisted frame locks the twist in permanently.', check: 'Both diagonals equal within about 5 mm.', durationSec: 600 },
      { title: 'Fit the back panel last and check it is straight', detail: 'The thin back panel is what stops the unit from racking, so nail or screw it on evenly from the middle outward, keeping the unit square as you go. Then fit the doors and align them by adjusting the hinges, not by bending anything.', check: 'Unit does not wobble, doors sit level with even gaps.', durationSec: 900 },
      { title: 'Anchor it to the wall', detail: 'Drill, plug and fix the supplied wall strap or bracket into a solid wall or a stud. Do this even if you think it looks stable — a tall unit is stable right up to the moment it is not.', check: 'Unit cannot be tipped forward by hand with moderate pressure.', durationSec: 600, risk: 'high' },
    ],
    followUps: [
      { id: 'q1', question: 'Do you have an electric screwdriver or drill?', kind: 'yes_no', options: ['Yes', 'No'], why: 'A drill speeds this up, but it also strips fittings if the torque is too high.', important: true },
      { id: 'q2', question: 'Are you building it alone?', kind: 'yes_no', options: ['Yes', 'No'], why: 'Two people makes the frame step dramatically easier.', important: true },
    ],
    askMeNext: ['The cam fitting will not lock', 'A screw hole is stripped', 'Which piece goes on next?'],
    answers: [
      { match: ['cam', 'fitting', 'will not lock', 'wont turn'], reply: 'A cam that will not lock is nearly always one of three things: the dowel is not fully seated in its hole, the cam arrow was not lined up with the incoming dowel before you pushed the panels together, or the cam is in the wrong hole. Check the dowel first — it should sit flush, not proud. If it will not go home, the hole may have a splinter in it. If the cam turns freely and never grabs, it has already been stripped and you need a replacement.' },
      { match: ['stripped', 'screw won\'t bite', 'hole is stripped', 'spins'], reply: 'For a stripped screw hole in particle board, the reliable fix is a wooden toothpick or a sliver of matchstick dipped in wood glue, packed into the hole, snapped off flush, and left to dry for an hour. Then the screw bites again. Do not use a bigger screw — it will split the panel.' },
    ],
  },

  /* ------------------------------------------------------------------ software / screen */
  {
    id: 'screen-help',
    intent: 'software',
    triggers: ['screenshot', 'settings', 'app', 'where do i click', 'how do i change', 'menu', 'password', 'wifi', 'account', 'notification', 'screen', 'interface'],
    categories: ['screen', 'document'],
    title: 'Find your way around a screen you do not recognise',
    situation: 'A screenshot of an app or settings screen you want to change.',
    sceneSummary: 'A software interface with a sidebar of menu items and a settings panel.',
    summary:
      'Reading an unfamiliar interface is a skill, not knowledge: menus are almost always grouped into a rail on the left or tabs along the top, and settings always follow the same pattern of category then option. I cannot read your specific screenshot offline, so tell me the words you can see on it and I will point you to the right place.',
    objects: ['Screenshot of a software interface'],
    tools: [],
    materials: [],
    safety: [safety('other', 'low', 'Screens can contain passwords, ID numbers and banking details.', 'Crop out anything private before sharing a screenshot anywhere, including with me.')],
    steps: [
      { title: 'Say out loud what the screen is called', detail: 'The title at the very top or the highlighted item in the sidebar is the name of where you are. Everything else sits relative to that.', check: 'You know the name of the screen you are on.', durationSec: 30 },
      { title: 'Find the navigation rail', detail: 'Almost every app puts its main sections either in a column down the left, tabs across the top, or a menu behind three lines (the hamburger) or your profile picture. That is your map — everything else is content.', check: 'You found the list of main sections.', durationSec: 45 },
      { title: 'Use the search inside settings', detail: 'Any settings screen on Android, iOS, Windows or macOS has a search box at the top. Type the word you want — "privacy", "notifications", "font" — and it jumps straight there, skipping the whole menu tree.', why: 'This is the single biggest time saver and almost nobody uses it.', check: 'Search box found at the top of the settings screen.', durationSec: 45 },
      { title: 'Change one thing at a time', detail: 'Make your change, then leave that screen and come back to confirm it stuck. Changing three toggles and then testing leaves you not knowing which one mattered.', check: 'One setting changed and verified.', durationSec: 60, tip: 'Screenshot the screen before you change anything. If it goes wrong you can see exactly what it looked like.' },
      { title: 'Know the universal escape hatches', detail: 'If you are lost: Back button or gesture goes up one level. Ctrl+Z (Cmd+Z on a Mac) undoes the last action. Pressing the home button or swiping up returns you to the start without losing anything. Nothing you click in a settings menu breaks the device permanently.', check: 'You tested going back and returning.', durationSec: 60 },
    ],
    software: {
      app: 'Unrecognised',
      path: ['Open the app or device Settings', 'Look for the search box at the top', 'Type the setting you want', 'Tap the matching result', 'Change it, then go back and confirm it stuck'],
      notes: [
        'Settings search is the fastest route on every modern platform.',
        'Nothing in a settings menu is destructive — you can always change it back.',
        'If a menu has gone missing, check whether a recent update moved it under a different heading.',
      ],
    },
    followUps: [
      { id: 'q1', question: 'What device is this on?', kind: 'choice', options: ['Android phone', 'iPhone', 'Windows PC', 'Mac', 'In a web browser'], why: 'The exact wording of menus differs by platform.', important: true },
      { id: 'q2', question: 'What is the name of the app or app screen?', kind: 'text', options: [], why: 'It tells me which menu structure you are looking at.', important: true },
      { id: 'q3', question: 'What do you want to change?', kind: 'text', options: [], why: 'The goal determines the shortcut.', important: true },
    ],
    askMeNext: ['I cannot find that option', 'Where do I click next?', 'Explain it more simply'],
    answers: [
      { match: ['screenshot', 'how do i take'], reply: 'Android: press power and volume-down together. iPhone with Face ID: press side button and volume-up together. iPhone with a home button: press home and side button together. Windows: press the Windows key and Shift and S at the same time to snip a region. Mac: Shift, Command and 4 to drag out an area. Then upload the file here and I will read it.' },
    ],
  },

  /* ------------------------------------------------------------------ learning */
  {
    id: 'laundry-symbols',
    intent: 'learn',
    triggers: ['laundry symbol', 'care label', 'wash symbol', 'care tag', 'label says', 'symbol on the tag'],
    categories: ['clothing'],
    title: 'Read a clothing care label',
    situation: 'A care label with washing symbols you want to understand.',
    sceneSummary: "A garment care label with a row of international laundry symbols.",
    summary:
      'Care labels are a five-symbol language and they always appear in the same order: wash, bleach, tumble dry, iron, professional care. Once you know the order you only have to recognise the shape, not memorise it.',
    objects: ['Care label'],
    tools: [],
    materials: [],
    safety: [],
    steps: [
      { title: 'Read them left to right, in a fixed order', detail: 'The tub is washing. The triangle is bleaching. The square with a circle is tumble drying. The iron is ironing. The circle is professional cleaning. They always appear in that order, which instantly tells you which symbol is which.', check: 'You can name the category of each symbol by position.', durationSec: 60 },
      { title: 'Read the numbers inside the tub', detail: 'A number means that temperature in Celsius is the maximum: 30, 40, 60, 95. A hand in the tub means hand wash only, cool. A tub with a bar underneath means a gentle cycle. A tub with a cross through it means do not machine wash at all.', check: 'You know the maximum temperature.', durationSec: 45 },
      { title: 'Dots on the iron are heat levels', detail: 'One dot is 110 °C (delicate synthetics), two dots is 150 °C (wool and polyester blends), three dots is 200 °C (cotton and linen). An iron with a cross means do not iron at all — usually because heat destroys a coating or a print.', check: 'Dot count noted.', durationSec: 30 },
      { title: 'Dots on the dryer too', detail: 'One dot is low heat, two is normal. A crossed-out square means do not tumble dry, lay flat instead. A square with a single line and a cross usually means dry flat rather than hang — hanging stretches knitwear.', check: 'Dry method decided.', durationSec: 30 },
      { title: 'When in doubt, go cold and gentle', detail: 'A 30 °C gentle cycle, low spin, low iron heat or none at all, and drying flat will not ruin anything. The only genuinely irreversible mistakes are hot water on wool and high heat on anything with elastane.', check: 'Nothing in the load is at risk.', durationSec: 30, tip: 'Photograph the label of anything precious once, save it, and never guess again.' },
    ],
    followUps: [
      { id: 'q1', question: 'What garment is it?', kind: 'choice', options: ['Cotton shirt or T-shirt', 'Wool or knitwear', 'Sportswear or stretchy fabric', 'Something with a print or coating'], why: 'The advice differs sharply per fabric.', important: true },
    ],
    askMeNext: ['How do I wash wool?', 'What does the triangle mean?', 'Can I put this in the tumble dryer?'],
  },
  {
    id: 'plant-care',
    intent: 'learn',
    triggers: ['plant', 'leaf', 'leaves', 'garden', 'wilting', 'yellow leaves', 'dying plant', 'water my plant', 'pot plant'],
    categories: ['plant'],
    title: 'Diagnose a struggling houseplant',
    situation: 'A plant with leaves that do not look healthy.',
    sceneSummary: 'A potted plant with foliage showing discolouration.',
    summary:
      'Almost every houseplant problem is one of four things, and the good news is that the leaves tell you which. The hard part is that overwatering and underwatering look almost identical at first — so we check the soil rather than guessing from the leaves.',
    objects: ['Potted plant'],
    tools: ['Your finger, or a wooden skewer'],
    materials: [],
    safety: [safety('chemical', 'low', 'Some houseplants are toxic to pets and children if chewed.', 'If you are unsure of the species, keep it out of reach rather than assuming it is safe.')],
    steps: [
      { title: 'Check the soil before anything else', detail: 'Push a finger, or a wooden skewer, 4 cm into the soil. If it comes out damp and the soil smells sour or earthy-wet, you have been overwatering. If it is bone dry and pulling away from the edge of the pot, you are underwatering.', why: 'Overwatering kills more houseplants than anything else, and it looks like underwatering from above.', check: 'You know whether the soil 4 cm down is wet, damp or dry.', durationSec: 120 },
      { title: 'Check the drainage actually works', detail: 'Lift the inner pot out of the outer pot. If the outer pot has water sitting in the bottom, the roots are drowning, no matter how little you water. A plant with no drainage hole at all will eventually rot.', check: 'No standing water, and water can escape the bottom.', durationSec: 120, tip: 'If there is no hole, water in the sink, let it drain completely, then put it back.' },
      { title: 'Read the leaf patterns', detail: 'Lower leaves yellow and the whole plant looks soft and limp: overwatering. Crisp brown edges and dry tips: underwatering, or too much direct sun. Yellow between the veins with green veins left: usually a nutrient deficiency. Pale, stretched, leaning toward the window: not enough light. Small sticky spots or fine webbing: pests.', check: 'You matched the pattern.', durationSec: 180 },
      { title: 'Correct one thing and wait', detail: 'If it is overwatered, stop watering entirely and let the soil dry out — this can take two weeks. If underwatered, soak the pot from the bottom in a basin for 20 minutes. Do not do both "just in case".', why: 'Plants respond slowly. Changing several things at once means you never learn what actually worked.', check: 'One variable changed, and written down.', durationSec: 300 },
      { title: 'Give it the right light, honestly', detail: 'Bright indirect light means near a window but not in the direct beam — a metre back from a bright window, or behind a sheer curtain. Most tropical houseplants will burn in direct midday sun, and almost none thrive in a dark corner.', check: 'The plant sits where light falls but not where sun strikes directly.', durationSec: 120 },
      { title: 'Repot only if the roots ask for it', detail: 'Slide the plant out and look at the root ball. If roots are circling the outside of the soil, it is pot-bound and needs one size up — no more, or the extra soil stays wet and rots. If the roots are brown and mushy with a bad smell, trim them off, use fresh soil and a clean pot.', check: 'Roots are white and firm, or you have repotted correctly.', durationSec: 600 },
    ],
    followUps: [
      { id: 'q1', question: 'Is the soil wet, damp or dry 4 cm down?', kind: 'choice', options: ['Wet', 'Damp', 'Dry'], why: 'This single answer resolves most plant problems.', important: true },
      { id: 'q2', question: 'How often do you water it?', kind: 'choice', options: ['Every day or two', 'About once a week', 'Only when I remember'], why: 'Frequency beats quantity for most houseplants.', important: true },
      { id: 'q3', question: 'How much light does it get?', kind: 'choice', options: ['Direct sun part of the day', 'Bright but no direct sun', 'A fairly dark spot'], why: 'Light drives how much water the plant uses.', important: true },
    ],
    askMeNext: ['The leaves are turning yellow', 'How often should I water it?', 'Should I repot it?'],
  },
  {
    id: 'document-read',
    intent: 'learn',
    triggers: ['document', 'letter', 'form', 'contract', 'what does this say', 'explain this', 'statement', 'account', 'terms'],
    categories: ['document', 'screen'],
    title: 'Understand a document or form',
    situation: 'A document you want explained in plain language.',
    sceneSummary: 'A printed document with paragraphs of dense text.',
    summary:
      'Documents are dense because they are written to be defended rather than read. I cannot read your specific page offline, but I can tell you exactly where the important parts always sit, so you know what to look for. You can also paste the text and I will go through it line by line once a key is configured.',
    objects: ['Document'],
    tools: [],
    materials: [],
    safety: [safety('other', 'medium', 'This is general guidance, not legal advice.', 'For anything with a signature, a payment obligation or a legal deadline, have it checked by someone qualified before you sign.', { escalate: true })],
    steps: [
      { title: 'Find the four parts that matter', detail: 'Who the parties are; what is being done and by when; how much is paid and when; and what happens if something goes wrong. These four things are the document. Everything else is explanation of them.', check: 'You can answer all four in one sentence each.', durationSec: 300 },
      { title: 'Read the section headers first', detail: 'Read only the bold headings from beginning to end. It takes two minutes and gives you the document’s actual structure — most people read linearly and lose the shape of it completely.', check: 'You can list the sections in order.', durationSec: 180 },
      { title: 'Hunt for the specific words that change everything', detail: 'Search or scan for: shall, must, may, within, not later than, subject to, provided that, and any date or number. "May" and "shall" are not the same word in a contract, and "within 7 days" is not "around 7 days".', check: 'You found every date, amount and deadline.', durationSec: 420 },
      { title: 'Find the obligations that land on you', detail: 'Look for the section that names you rather than both parties. That is where your duties, notice periods and exclusions live. Cross-check it against the definitions section at the start — documents often redefine everyday words.', check: 'You listed what you must do and by when.', durationSec: 300 },
      { title: 'Note the escape routes and the penalties', detail: 'Look for how to cancel, what happens on cancellation, what is not covered, and the notice period. These clauses are short and are where the money is.', check: 'You know how to get out, and what it costs.', durationSec: 300 },
      { title: 'Get the unclear bits answered in writing', detail: 'Write down each question as you go and ask them all at once, in an email so you have a record. An answer in writing is worth ten verbal reassurances.', check: 'Questions sent, answers received in writing.', durationSec: 300 },
    ],
    followUps: [
      { id: 'q1', question: 'What kind of document is it?', kind: 'choice', options: ['A bill or statement', 'A contract or agreement', 'A form to fill in', 'A letter from a company or government'], why: 'The structure and the risks differ for each.', important: true },
      { id: 'q2', question: 'Is there a deadline or an amount of money on it?', kind: 'yes_no', options: ['Yes', 'No'], why: 'Deadlines and amounts drive urgency.', important: true },
      { id: 'q3', question: 'Do you need to sign or pay something?', kind: 'yes_no', options: ['Yes', 'No'], why: 'That determines how careful you need to be.', important: true },
    ],
    askMeNext: ['What does this section mean?', 'Do I have to sign this?', 'Explain it more simply'],
  },
  {
    id: 'water-leak',
    intent: 'fix',
    triggers: ['leak', 'dripping', 'tap', 'faucet', 'toilet', 'cistern', 'overflow', 'water', 'burst'],
    categories: ['room'],
    title: 'Stop a leaking tap or running toilet',
    situation: 'Water dripping or running where it should not.',
    sceneSummary: 'A tap or toilet cistern area with visible water.',
    summary:
      'A dripping tap is usually a washer or a cartridge, and a toilet that keeps running is usually a worn flush valve seal. Both are inexpensive parts. The thing to fix first is not the drip — it is making sure the water is off before you undo anything.',
    objects: ['Tap', 'Cistern'],
    tools: ['Adjustable spanner', 'Flat screwdriver', 'Cloth and a bucket'],
    materials: ['Replacement washer or cartridge', 'Plumber’s tape'],
    safety: [
      safety('water', 'medium', 'Water and electricity together are lethal.', 'If the leak is anywhere near a socket, a light fitting or the distribution board, switch that circuit off at the board before touching anything.'),
      safety('water', 'low', 'Undoing a fitting without the supply off floods the room in seconds.', 'Close the isolating valve under the tap or the main stopcock first, then open the tap to prove the water really is off.', { stop: false }),
    ],
    steps: [
      { title: 'Prove the water is off before you touch anything', detail: 'Close the little isolating valve on the pipe under the fitting — the slot should then be across the pipe, not along it. Then turn the tap on. If water still runs, you closed the wrong valve or it has seized; find the main stopcock and close that instead.', why: 'The single most common DIY flood is assuming a valve worked.', check: 'Tap runs dry.', durationSec: 180, risk: 'medium' },
      { title: 'Plug the waste and cover the drain', detail: 'Put the plug in the basin, and drape a cloth over the overflow and the drain. Small parts — screws, circlips, washers — love drains more than anything else in the house.', check: 'Drain covered and plug in.', durationSec: 60 },
      { title: 'Identify which type of tap you have', detail: 'A traditional tap has a head that unscrews, and inside is a rubber washer on a brass jumper. A modern quarter-turn tap has a ceramic cartridge inside, and washers do not exist in it. This matters — the parts are completely different.', check: 'You know whether you need a washer or a cartridge.', durationSec: 120 },
      { title: 'Dismantle and inspect, in order', detail: 'For a traditional tap, prise off the index cap (usually marked H or C), undo the screw underneath, lift off the handle, unscrew the shroud by hand, then use the spanner on the head nut. Look at the washer: if it is flattened, cracked or grooved, that is your leak.', check: 'Washer visibly damaged, or cartridge seals worn.', durationSec: 420, risk: 'medium' },
      { title: 'Replace the part, not the whole tap', detail: 'Take the old washer to a hardware store and match it, or note the cartridge model. Reassemble in reverse, using plumber’s tape on the threads — wound clockwise as you look at the end of the thread, or it unwinds when you tighten.', check: 'Everything hand-tight plus a quarter turn with the spanner, nothing cross-threaded.', durationSec: 600 },
      { title: 'Test slowly and check underneath', detail: 'Open the isolating valve a quarter turn and watch. Then open the tap fully and check both the outlet and the connection underneath with a dry tissue — a tissue shows the tiniest seep instantly where your fingers would not feel it.', check: 'Dry tissue stays dry after two minutes of running.', durationSec: 300 },
      { title: 'For a running toilet, replace the flush seal', detail: 'Turn the water off, flush to empty the cistern, then unhook the flush valve or the flapper. Look at the rubber seal where it sits — if it is scaled, warped or coated in black slime, water is seeping past it constantly. Replace the seal or the whole valve, which usually costs very little.', check: 'Cistern stops filling and stays silent after a flush.', durationSec: 900 },
    ],
    followUps: [
      { id: 'q1', question: 'Where is the water — a tap, a toilet, or a pipe?', kind: 'choice', options: ['A dripping tap', 'A toilet that keeps running', 'A pipe joint', 'I cannot see where it is coming from'], why: 'Each has a different fix and different urgency.', important: true },
      { id: 'q2', question: 'Can you find the isolating valve or the main stopcock?', kind: 'yes_no', options: ['Yes', 'No'], why: 'Nothing should be undone before the water is off.', important: true },
    ],
    askMeNext: ['I cannot find the stopcock', 'The tap still drips after fixing it', 'Should I call a plumber?'],
    answers: [
      { match: ['stopcock', 'cannot find the valve', 'where is the stopcock'], reply: 'The main stopcock is usually where the water pipe enters the house — often under the kitchen sink, in a downstairs bathroom, or in a meter box at the boundary. Look for a brass tap or a slot-headed valve on the incoming pipe. If the house has a geyser, there is also an isolating valve on the cold inlet to it. Open and close the main valve once a year so it does not seize — a seized valve is the reason a small leak becomes a flood.' },
      { match: ['call a plumber', 'professional', 'should i call someone'], reply: 'Call a professional if: the leak is inside a wall or under a floor, the pipe is copper and has actually split, the issue is the geyser or its pressure valve, or you have shut the main valve and water is still coming in. Everything else — washers, cartridges, cistern seals, flexible connectors — is genuinely a DIY job with a spanner and a R50 part.' },
    ],
  },
  {
    id: 'electricity-safety',
    intent: 'safety',
    triggers: ['electricity', 'electric', 'plug', 'socket', 'db board', 'distribution board', 'tripping', 'trip switch', 'shock', 'shock me', 'earth leakage'],
    categories: ['appliance', 'room'],
    title: 'Handle an electrical problem without getting hurt',
    situation: 'An electrical fault or trip you want to deal with.',
    sceneSummary: 'A wall socket or distribution board area.',
    summary:
      'Electricity is the one area where I will hold you back rather than talk you through it. A tripping breaker is genuinely diagnosable by unplugging things one at a time — that part is safe. Anything involving opening a socket, a light fitting, a distribution board cover or replacing a switch is not, and I will tell you so.',
    objects: ['Socket', 'Distribution board'],
    tools: ['Phone torch'],
    materials: [],
    safety: [
      safety('electricity', 'critical', 'Mains electricity kills. A shock of 50 mA across the heart is enough to be fatal.', 'Never open a socket, light fitting or distribution board. Never work on any circuit you have not confirmed is isolated at the board — and remember that switching off one breaker does not guarantee the neutral is dead.', { stop: true, escalate: true }),
      safety('electricity', 'high', 'A warm plug, a scorch mark, or a buzzing socket is a fire risk, not a nuisance.', 'Stop using that socket immediately and do not use the appliance again. A burnt smell anywhere near wiring needs an electrician today.', { stop: true, escalate: true }),
      safety('electricity', 'high', 'Water plus electricity is lethal, and this is exactly when people reach for things.', 'If something electrical is wet or a shock has occurred, switch off at the main breaker with something dry and non-conductive, or do not touch it at all and call for help.', { stop: false, escalate: true }),
      safety('fire', 'high', 'Never put water on an electrical fire.', 'Switch off at the board if you can reach it safely, then use a dry powder or CO2 extinguisher or get out and call the fire service.', { stop: false, escalate: true }),
    ],
    steps: [
      { title: 'If anyone has received a shock, this is the whole plan', detail: 'Do not touch the person while they may still be in contact with the source. Switch off the supply at the board, or use something dry and non-conductive — a wooden broom handle — to move the source away. Then call emergency services. Anyone who has had a significant shock should be checked even if they feel fine, because heart rhythm problems can start hours later.', check: 'Supply off, emergency services called, no one touching anyone.', durationSec: 120, risk: 'critical' },
      { title: 'For a tripping breaker: isolate rather than reset blindly', detail: 'Turn off every switch on that circuit, reset the breaker once, and turn the switches back on one at a time, pausing 30 seconds each time. The one that trips it again is your culprit.', why: 'Resetting a breaker over and over without finding the load can turn a fault into a fire.', check: 'You have identified the device or socket that trips it.', durationSec: 900, risk: 'medium' },
      { title: 'For an earth-leakage trip, suspect water and failing elements', detail: 'An earth-leakage switch that trips is telling you current is escaping to earth — which is exactly what you want it to do. Common causes are a geyser element, a kettle or an appliance that has got wet, or a damp outdoor socket. Unplug everything on that circuit and reset. If it holds, add things back one at a time.', check: 'The circuit holds with everything unplugged.', durationSec: 900, risk: 'medium' },
      { title: 'If a breaker will not reset at all, stop', detail: 'A breaker that immediately trips with nothing plugged in is either faulty or there is a genuine fault in the fixed wiring. Do not tape it up, do not hold it, and do not replace it with a bigger one. Leave it off and call an electrician.', check: 'Circuit isolated and an electrician booked.', durationSec: 300, risk: 'high' },
      { title: 'Do the genuinely useful DIY bit: replace the appliance, not the wiring', detail: 'If you have found that a specific appliance trips the circuit, unplugging it and using a different one is a complete solution that needs no electrical work at all. That is the safe answer, and often the cheapest.', check: 'Offending appliance taken out of use.', durationSec: 120 },
      { title: 'Book the right person and describe it properly', detail: 'A registered electrician, not a handyman, and in South Africa they should be able to issue a Certificate of Compliance for regulated work. Tell them: which circuit, what trips it, and whether it trips with nothing plugged in — that description alone saves them an hour and you money.', check: 'Electrician booked with a clear description.', durationSec: 300 },
    ],
    followUps: [
      { id: 'q1', question: 'Has anyone been shocked?', kind: 'yes_no', options: ['Yes', 'No'], why: 'This changes everything, and it needs urgent medical attention even if they feel fine.', important: true },
      { id: 'q2', question: 'Is it a tripped breaker, a socket problem, or a whole area with no power?', kind: 'choice', options: ['A breaker keeps tripping', 'One socket is dead or scorched', 'A whole area has no power', 'A light or fixture is faulty'], why: 'Each has a different safe answer.', important: true },
      { id: 'q3', question: 'Can you smell burning near the board or the socket?', kind: 'yes_no', options: ['Yes', 'No'], why: 'A burning smell means stop using it now.', important: true },
    ],
    askMeNext: ['The breaker will not reset', 'My plug is warm to touch', 'Is this something I can fix myself?'],
    knowledge: [
      { claim: 'An earth-leakage device tripping is a safety feature working, not a fault in your board.', why: 'It detects current leaking to earth — often through a person or through water — and disconnects within milliseconds. Resetting it without finding the cause removes your protection.', confidence: 'high' },
      { claim: 'A registered electrician should do any fixed wiring work.', why: 'Beyond the legal requirement for a Certificate of Compliance on regulated work, insurance claims can be refused if unqualified people have altered the installation.', confidence: 'high' },
    ],
    videos: [{ title: 'What to do when your breaker trips', query: 'what to do when a circuit breaker keeps tripping safely', why: 'Shows the isolation method safely.' }],
  },
  {
    id: 'iron-clothes',
    intent: 'use',
    triggers: ['iron', 'ironing', 'crease', 'settings on iron', 'temperature for ironing'],
    categories: ['appliance', 'clothing'],
    title: 'Set the iron correctly so you do not scorch anything',
    situation: 'An iron with a temperature dial and fabric settings.',
    sceneSummary: 'A steam iron with a temperature dial showing dot markings and a steam control.',
    summary:
      'Iron temperatures are printed as dots or as fabric names, and the order matters: you iron from cool to hot as you go, never hot to cool. That one habit prevents almost all scorching, because you never have to wait for the iron to cool down.',
    objects: ['Steam iron'],
    tools: [],
    materials: ['Water (if using steam)', 'Ironing board', 'A clean cotton cloth for delicate items'],
    safety: [
      safety('fire', 'medium', 'An iron left face-down will burn through a board and start a fire.', 'Always stand it upright, and never leave it plugged in and unattended.'),
      safety('chemical', 'medium', 'A hot iron on a synthetic fabric melts it onto the soleplate and the mark transfers to the next garment.', 'Test on a hidden hem or an inside seam first for anything you are unsure about.'),
      safety('sharp', 'low', 'Steam burns are worse than dry heat burns.', 'Keep hands clear of the steam vents when you press the steam button.'),
    ],
    steps: [
      { title: 'Set the dial by dots, and go cold to hot', detail: 'One dot is 110 °C (acetate, nylon, silk). Two dots is 150 °C (polyester blends, wool). Three dots is 200 °C (cotton, linen). Iron in that order — nylon first, linen last — because the iron only heats up quickly and takes ages to cool down.', why: 'You will scorch something and have to wait ten minutes if you iron linen first and then a nylon shirt.', check: 'Dial set to the dot count for the first garment.', durationSec: 60, diagram: { label: 'Temperature dial', position: 'tc', kind: 'dial' } },
      { title: 'Check the fabric, not the assumption', detail: 'Look at the care label inside the garment. If it shows an iron with a cross, do not iron it at all — that is usually a coated fabric, a print, or a pile that heat will destroy permanently. When there is no label, test on an inside seam.', check: 'Label read, or test done on a hidden seam.', durationSec: 90 },
      { title: 'Decide about steam', detail: 'Steam helps cotton and linen but can water-spot silk and leave marks on dark fabric. For dark garments, iron on the inside or use a dry iron with a pressing cloth. Fill with tap water unless the manual says distilled — most modern irons are fine with tap water.', check: 'Steam setting matches the fabric.', durationSec: 60, diagram: { label: 'Steam control', position: 'ml', kind: 'dial' } },
      { title: 'Iron in the right direction by fabric', detail: 'Cotton and linen: iron damp, press hard, move slowly. Wool: steam and press, never drag — dragging stretches it out of shape. Synthetics: low heat, keep the iron moving constantly or it will glaze the surface. Silk: inside out or under a cloth, low heat.', check: 'No shine appearing on the fabric surface.', durationSec: 300 },
      { title: 'Ventilated or embroidered areas go face down', detail: 'Iron embroidery and prints from the reverse side, on a towel, so the stitching or the print does not flatten and stick to the soleplate.', check: 'Detail still has relief, not flattened.', durationSec: 120, tip: 'A scorch mark on the soleplate: let it cool, then rub with a paste of bicarbonate of soda and water on a cloth.' },
      { title: 'Empty and stand it upright when you finish', detail: 'Unplug it, empty the water tank so it does not corrode or spit mineral flakes next time, and stand it upright to cool completely before putting it away.', check: 'Unplugged, emptied, upright.', durationSec: 120 },
    ],
    followUps: [
      { id: 'q1', question: 'What fabric are you ironing?', kind: 'choice', options: ['Cotton or linen', 'Polyester or a blend', 'Wool or knitwear', 'Silk or something delicate'], why: 'Temperature and technique change for each.', important: true },
      { id: 'q2', question: 'Is the garment dark coloured?', kind: 'yes_no', options: ['Yes', 'No'], why: 'Dark fabrics show heat shine and water marks badly.', important: false },
    ],
    askMeNext: ['I scorched it, what now?', 'How do I get creases out of a shirt collar?', 'What does this label symbol mean?'],
    answers: [
      { match: ['scorch', 'burnt', 'burn mark', 'shiny', 'shine'], reply: 'For a scorch mark: dab with cold water and a little mild detergent, then treat with hydrogen peroxide on white cotton only, and wash normally. For a shine mark on wool or polyester, sponge with a cloth wrung out in equal parts white vinegar and water, then press with a cloth over it — heat shine is a flattened fibre, and steam can often lift it. If the fibre has actually melted, it cannot be undone.' },
    ],
  },
]

/* ------------------------------------------------------------------ matching */

/** Score how well a scenario fits what the user typed. */
export function scoreScenario(scenario: Scenario, text: string, category: string): number {
  const lower = ` ${text.toLowerCase()} `
  let score = 0
  for (const t of scenario.triggers) {
    if (lower.includes(` ${t}`) || lower.includes(`${t} `)) score += t.includes(' ') ? 3 : 2
  }
  if (scenario.categories.includes(category as never)) score += 1.6
  if (scenario.intent === 'identify' && /what (is|are) (this|these)|identify|whats this/i.test(text)) score += 2
  return score
}

export function pickScenario(text: string, category: string): Scenario | null {
  const ranked = SCENARIOS.map((s) => ({ s, score: scoreScenario(s, text, category) })).sort((a, b) => b.score - a.score)
  if (!ranked.length || ranked[0].score < 1.5) return null
  return ranked[0].s
}

export function emptyAnnotations(): Annotation[] {
  return []
}
