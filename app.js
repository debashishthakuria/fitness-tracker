/* Athletic & Lean Tracker - shared data and helpers */
(function(){
"use strict";

var STORE_KEY = "ftStateV1";
var EQUIP_FLAG = "ftEquipDefaultV2";

function defState(){
  return {
    equipment: true,           // true = dumbbells + bar (he has the gear), false = bodyweight
    startDate: null,           // plan start date YYYY-MM-DD (for supplement phases)
    ticks: {},                 // "<week>|<day>|<itemId>" -> true
    habits: {},                // "<date>|<habitId>" -> true
    meals: {},                 // "<date>|<mealItemId>" -> true
    football: {},              // "<week>|<day>" -> true
    sessions: [],              // {date, day, seconds, ts}
    activeSession: null,       // {day, date, startTs}
    weights: [],               // {date, kg}
    startKg: 80                // start weight, editable
  };
}

function load(){
  var s;
  try{
    var raw = localStorage.getItem(STORE_KEY);
    if(!raw){ s = defState(); }
    else{
      s = JSON.parse(raw);
      var d = defState();
      for(var k in d){ if(!(k in s)) s[k]=d[k]; }
    }
  }catch(e){ s = defState(); }
  // One-time switch: his dumbbells and pull-up bar have arrived, so the
  // equipment plan becomes the default even on a device with a saved state.
  try{
    if(!localStorage.getItem(EQUIP_FLAG)){
      s.equipment = true;
      localStorage.setItem(EQUIP_FLAG,"1");
      save(s);
    }
  }catch(e){}
  return s;
}
function save(s){ localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

var DAYS = ["sun","mon","tue","wed","thu","fri","sat"];
var DAY_SHORT = {sun:"Sun",mon:"Mon",tue:"Tue",wed:"Wed",thu:"Thu",fri:"Fri",sat:"Sat"};

function pad(n){ return (n<10?"0":"")+n; }
function dateStr(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function todayStr(){ return dateStr(new Date()); }
function dayKeyOf(dateStrV){
  var p = dateStrV.split("-");
  var d = new Date(+p[0], +p[1]-1, +p[2]);
  return DAYS[d.getDay()];
}
function todayDayKey(){ return DAYS[new Date().getDay()]; }
function weekKey(dateStrV){
  var p = (dateStrV||todayStr()).split("-");
  var d = new Date(+p[0], +p[1]-1, +p[2]);
  // ISO week
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dayNum = (t.getUTCDay()+6)%7;
  t.setUTCDate(t.getUTCDate()-dayNum+3);
  var firstThu = new Date(Date.UTC(t.getUTCFullYear(),0,4));
  var fdayNum = (firstThu.getUTCDay()+6)%7;
  firstThu.setUTCDate(firstThu.getUTCDate()-fdayNum+3);
  var week = 1 + Math.round((t-firstThu)/(7*24*3600*1000));
  return t.getUTCFullYear()+"-W"+pad(week);
}
function fmtDur(sec){
  sec = Math.round(sec);
  var h = Math.floor(sec/3600), m = Math.round((sec%3600)/60);
  if(h>0) return h+" h "+m+" min";
  if(m>0) return m+" min";
  return sec+" sec";
}
function fmtClock(sec){
  sec = Math.floor(sec);
  var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  if(h>0) return h+":"+pad(m)+":"+pad(s);
  return pad(m)+":"+pad(s);
}
function niceDate(dateStrV){
  var p = dateStrV.split("-");
  var d = new Date(+p[0], +p[1]-1, +p[2]);
  var M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return M[d.getMonth()]+" "+d.getDate();
}

/* ---------------- PLAN DATA ---------------- */

var NOTES = [
  {t:"Football swap rule", d:"Whenever a football match is fixed on any day, skip that day's planned workout or ride and let the game count."},
  {t:"Keep it short", d:"3-5 focused moves a day. Quality reps beat volume. Rest 60-90 seconds between sets unless noted."},
  {t:"Weight selection", d:"Pick a moderate weight where the last 2-3 reps feel hard without swinging your body or losing good posture. The goal is lean and athletic (around 70 kg), not heavy bulk."},
  {t:"Tempo", d:"Lower slowly and with control, about 3 seconds down on every rep, then press or pull up smoothly."},
  {t:"Joint safety", d:"Ease into high-leverage moves like Fingertip Push-ups and Archer Push-ups. Start on your knees or with a few reps, and stop if a wrist, elbow or shoulder feels sharp. Keep neck isometrics moderate and never yank."},
  {t:"Pull-up tip", d:"If full pull-ups feel too heavy right now, jump up so your chin is over the bar and lower yourself down as slowly as possible (3-5 seconds). Do 4-5 slow lowers per set."},
  {t:"How to progress", d:"Once you hit the top rep number cleanly on all sets, slow the lowering to 4 seconds, add a rep or two, or move up 2 kg / 2.5 kg."}
];

function ex(id,name,muscle,dose,steps,vids,group){
  return {id:id,name:name,muscle:muscle,dose:dose,steps:steps,vids:vids||[],group:group||null};
}
function V(id,label){ return {id:id,label:label}; }

var PLAN = {
  sun:{
    name:"Sunday", title:"Upper Body Push", sub:"Chest, shoulders, back of arms · 5 moves", type:"workout",
    equip:[
      ex("y-t-w","Prone Floor Y-T-Ws (warm-up)","Upper back & posture","2 rounds × 8 reps per letter",
        ["Lie face down, forehead resting on the floor, arms reaching long. No weights.",
         "Lift your arms into a Y, then a T (straight out to the sides), then a W (elbows bent, squeezing shoulder blades). Thumbs point up.",
         "Move slowly, pause 1 second at the top of each rep, and keep your neck relaxed and long."],[]),
      ex("db-floor-press","Dumbbell Floor Press","Chest & arms","3 sets × 10-12 reps",
        ["Lie flat on your back on a folded bedsheet/rug with knees bent and feet flat on the floor.",
         "Hold a dumbbell in each hand, upper arms resting on the floor at a 45-degree angle from your body.",
         "Push the weights straight up toward the ceiling, then lower for a slow 3-second count until your elbows lightly touch the floor."],
        [V("Bx4QPVH-J1g","Form video")]),
      ex("decline-pushups","Decline Push-ups","Upper chest & shoulders","3 sets × 8-12 reps",
        ["Put your feet on a sturdy bed or chair, hands on the floor just wider than shoulders, body straight from head to heels.",
         "Lower your chest toward the floor for 3 seconds, then push back up. Keep your stomach tight."],[]),
      ex("db-shoulder-press","Dumbbell Shoulder Press + Wall Isometric Lateral Raises","Shoulders","3 sets × 10-12 reps, then 2 × 20-30 sec holds per arm",
        ["Stand or sit tall holding a dumbbell in each hand at shoulder height, palms forward. Keep your stomach tight (no arching) and press straight overhead, then lower slowly.",
         "Wall holds: stand side-on to a wall, back of your hand and forearm against it. Press the wall outward as if raising your arm to the side, and hold with steady, moderate effort. Do not shrug."],
        [V("qEwKCR5JCog","Press form video")]),
      ex("diamond-sphinx","Diamond Push-ups + Sphinx Push-ups","Back of arms (triceps)","2 rounds × 6-10 diamond, 6-8 sphinx",
        ["Diamond: hands close together under your chest with thumbs and index fingers making a diamond. Lower slowly, elbows tucked close. Drop to your knees if your form breaks.",
         "Sphinx (bodyweight tricep extension): forearms on the floor in a plank. Press your hands into the floor to straighten your arms into a high plank, then lower back to your forearms with control. Go slow and keep your wrists and elbows comfortable."],[])
    ],
    body:[
      ex("bw-y-t-w","Prone Floor Y-T-Ws (warm-up)","Upper back & posture","2 rounds × 8 reps per letter",
        ["Lie face down, arms reaching long. Lift into a Y, then a T, then a W, squeezing your shoulder blades.",
         "Move slowly and pause 1 second at the top of each rep."],[]),
      ex("bw-decline-pushups","Decline Push-ups","Upper chest & shoulders","3 sets × 8-12 reps",
        ["Feet on a sturdy bed or chair, hands on the floor, body straight. Lower for 3 seconds and push back up."],[]),
      ex("bw-pike-pushups","Pike Push-ups","Shoulders","3 sets × 6-10 reps",
        ["Hips high so your body forms an upside-down V.",
         "Lower your head toward the floor between your hands for 3 seconds, then push back up."],
        [V("shEnAXgc9y4","Form video")]),
      ex("bw-diamond","Diamond Push-ups","Back of arms (triceps)","3 sets × 6-10 reps",
        ["Hands close together under your chest, thumbs and index fingers making a diamond.",
         "Lower slowly with elbows tucked close, then push up. Drop to your knees if your form breaks."],[]),
      ex("bw-sphinx","Sphinx Push-ups (Bodyweight Tricep Extensions)","Back of arms (triceps)","3 sets × 6-8 reps",
        ["Forearms on the floor in a plank. Press into your hands to straighten into a high plank, then lower back to your forearms with control.",
         "Keep it slow and stop if your wrists or elbows complain."],[])
    ]
  },
  mon:{
    name:"Monday", title:"Rest & Reset", sub:"College day - recovery", type:"rest",
    items:[
      {id:"walk", text:"20-30 minute easy walk", hint:"Keep it relaxed - this is recovery."},
      {id:"stretch", text:"Light stretching at night", hint:"5-10 minutes is enough."},
      {id:"chin-tucks", text:"Gentle Chin Tucks: 2 sets × 10 reps", hint:"Sit tall, glide your chin straight back like making a double chin, hold 2 seconds, release. No force, no pain."},
      {id:"targets", text:"Hit your protein, water and sleep targets", hint:"115-135 g protein, 3-3.5 L water, wind down before midnight."}
    ]
  },
  tue:{
    name:"Tuesday", title:"Morning Cycling", sub:"Before college", type:"cycle",
    items:[
      {id:"ride", text:"35-45 minute steady ride before heading out for college", hint:"Firm but comfortable pace."},
      {id:"snack", text:"Small bite 15-20 minutes beforehand", hint:"A banana or a few soaked almonds/dates with water for steady energy."}
    ]
  },
  wed:{
    name:"Wednesday", title:"Pull + Biceps/Forearms + Core", sub:"Back, arms, forearms, core · 5 moves", type:"workout",
    equip:[
      ex("back-widows","Back Widows + Prone Lat Pull-Downs (warm-up)","Upper back & posture","2 rounds × 10 reps each",
        ["Back Widows: lie face down, arms bent at your sides like a goalpost. Lift your chest slightly and squeeze your shoulder blades together, then slide your arms back toward your hips.",
         "Prone Lat Pull-Downs: lie face down with arms reaching long overhead. Pull your elbows down toward your ribs as if pulling a bar, squeezing your back. No bar, no weight.",
         "Go slow and keep your neck long and relaxed."],[]),
      ex("pullups","Doorway Pull-ups or Chin-ups","Upper back & V-taper","4 sets × max clean reps (leave 1 rep in the tank)",
        ["Grip the bar slightly wider than shoulders (palms away for pull-ups, or palms toward you for chin-ups).",
         "Pull your chest up toward the bar without kicking your legs, and lower for a slow 3-second count. If full reps are too heavy, jump up and do 4-5 slow lowers."],
        [V("I3vH43n7n2Q","Pull-up form"), V("gbPURTSxQLY","Slow lowers (beginner)")]),
      ex("one-arm-row","One-Arm Dumbbell Row","Mid-back","3 sets × 10-12 reps per arm",
        ["Place one knee and one hand on your bed or a sturdy chair so your back is flat like a tabletop.",
         "Pull a dumbbell up toward your hip (elbow tucked close), squeeze your back, and lower slowly."],
        [V("epSR-ma7BsY","Form video")]),
      ex("curls","Biceps & Forearms: Curls, Hammer Curls, Wrist Work","Biceps & forearms","Curls 3 × 10-12, hammer 2 × 10-12, wrist 2 × 15 each",
        ["Dumbbell curls and hammer curls: elbows pinned at your sides, no swinging, slow 3-second lowering.",
         "Self-resisted wrist curls and extensions: rest your forearm on your thigh, palm up, and curl your wrist up while the other hand pushes down for resistance. Flip palm down for extensions. Use moderate pressure only.",
         "No dumbbells handy? Do seated leg-resisted curls: sit, hook your foot over your wrist and curl against the leg, or curl one hand against the other."],
        [V("b0pZWf3vfRk","Bicep curl form"), V("zC3nLlEvin4","Hammer curl form")]),
      ex("core-finisher","Core Finisher: Hollow Body Hold + Lying Leg Raises","Core","3 rounds × 20-30 sec hold + 10-12 raises",
        ["Hollow Body Hold: lie on your back, press your lower back into the floor, lift your shoulders and straight legs a few inches, and hold. Bend your knees to make it easier.",
         "Lying Leg Raises: legs straight, lower them slowly without touching the floor, then lift. Keep your lower back pressed down."],
        [V("0tzBVqiDwSs","Leg raises")])
    ],
    body:[
      ex("bw-back-widows","Back Widows + Prone Lat Pull-Downs (warm-up)","Upper back & posture","2 rounds × 10 reps each",
        ["Back Widows: face down, arms like a goalpost, lift your chest slightly, squeeze your shoulder blades and slide your arms back to your hips.",
         "Prone Lat Pull-Downs: face down, arms long overhead, pull your elbows to your ribs. No weight."],[]),
      ex("bw-table-rows","Under-Table Rows","Back & arms","4 sets × 8-12 reps",
        ["Lie under a sturdy table, grip the edge, and pull your chest up to it. Lower with control."],
        [V("OYUxXMGVuuU","Form video")]),
      ex("bw-doorframe-rows","Doorframe Rows","Back","3 sets × 12 reps per side",
        ["Stand in a doorway holding the frame edge, lean back with straight arms, and pull your body in."],
        [V("yeJARDrk1R8","Form video")]),
      ex("bw-arms","Self-Resisted Biceps & Forearms","Biceps & forearms","2 × 10-12 curls per arm, 2 × 15 wrist moves each",
        ["Seated leg-resisted curl: sit, hook your foot over your wrist and curl your hand up against your leg's resistance. Or press one hand against the other.",
         "Self-resisted wrist curls and extensions: forearm on your thigh, the other hand pushes against the moving hand. Moderate pressure only."],[]),
      ex("bw-core","Core Finisher: Hollow Body Hold + Lying Leg Raises","Core","3 rounds × 20-30 sec hold + 10-12 raises",
        ["Hollow hold: lower back pressed into the floor, shoulders and straight legs a few inches up. Bend your knees to make it easier.",
         "Leg raises: lower slowly, no touching the floor."],
        [V("0tzBVqiDwSs","Leg raises")])
    ]
  },
  thu:{
    name:"Thursday", title:"Legs & Lower Body", sub:"Thighs, glutes, calves + hands & neck · 5 moves", type:"workout",
    equip:[
      ex("goblet-squats","Goblet Squats","Thighs & glutes","3 sets × 12-15 reps",
        ["Hold one dumbbell vertically against your chest with both hands.",
         "Feet shoulder-width apart; sit back and down with a slow 3-second descent, chest tall and heels flat, then push through your heels to stand."],
        [V("9KzZD_n2r64","Form video")]),
      ex("db-rdl","Dumbbell Romanian Deadlifts","Back of thighs","3 sets × 10-12 reps",
        ["Hold dumbbells in front of your thighs with knees slightly unlocked.",
         "Keep your back flat and push your hips straight back, lowering the weights along your shins until you feel a stretch in the back of your thighs, then stand tall."],
        [V("hu3jRvTc_po","Form video")]),
      ex("split-squats","Split Squats","Single-leg strength","3 sets × 8-10 reps per leg",
        ["Hold dumbbells at your sides, step one foot forward and lower your back knee toward the floor until both knees reach about 90 degrees.",
         "Push through the front heel to stand."],
        [V("m8mQ_92_Ylg","Form video")]),
      ex("calf-raises","Weighted Calf Raises","Lower legs","3 sets × 15-20 reps",
        ["Hold dumbbells at your sides, rise high onto your tiptoes, pause 1 second at the top, and lower slowly."],
        [V("k8ipHzKeAkQ","Form video")]),
      ex("hands-neck","Hands & Neck Finisher","Fingers, wrists & neck","5-8 min, easy effort",
        ["Finger Flashes: make a tight fist, then spread your fingers wide. 2 × 20 reps.",
         "Palm Raises: palms flat on the floor or a table, lift your palms up while the fingertips stay down, then lower. 2 × 10. Fingertip Push-ups: start on your knees, a few reps only, and add reps slowly over weeks.",
         "Chin Tucks: 2 × 10 gentle reps. 4-Way Neck Isometrics: press your hand against your head (front, back, left, right) with moderate pressure, hold 5 seconds each way. Do not yank or push hard."],[])
    ],
    body:[
      ex("bw-squats","Bodyweight Squats","Thighs & glutes","3 sets × 15-20 reps",
        ["Feet shoulder-width apart, sit your hips back and down for 3 seconds, chest tall, heels flat."],
        [V("PlDqgNcJJ2U","Form video")]),
      ex("bw-rev-lunges","Reverse Lunges","Legs","3 sets × 10 reps per leg",
        ["Step backward into a lunge, lower until both knees are near 90 degrees, push back up."],
        [V("Q2k3kYbtOcI","Form video")]),
      ex("bw-glute-bridges","Glute Bridges","Glutes","3 sets × 15 reps",
        ["Lie on your back, knees bent, drive your hips up and squeeze at the top."],
        [V("wPM8icPu6H8","Form video")]),
      ex("bw-calf-raises","Standing Calf Raises","Calves","3 sets × 20 reps",
        ["Rise high onto your tiptoes, pause 1 second at the top, lower slowly."],
        [V("k8ipHzKeAkQ","Form video")]),
      ex("bw-hands-neck","Hands & Neck Finisher","Fingers, wrists & neck","5-8 min, easy effort",
        ["Finger Flashes: tight fist, then spread fingers wide. 2 × 20.",
         "Palm Raises: palms flat on a table, lift palms while fingertips stay down. 2 × 10. Fingertip Push-ups from your knees, a few reps only.",
         "Chin Tucks 2 × 10, and 4-Way Neck Isometrics: hand pressed against your head, hold 5 seconds each direction, moderate pressure, no yanking."],[])
    ]
  },
  fri:{
    name:"Friday", title:"Cycling", sub:"Steady ride or intervals", type:"cycle",
    items:[
      {id:"ride-a", text:"Option A: 45-50 minute steady ride", hint:"Firm, sweating pace. Pick A or B."},
      {id:"ride-b", text:"Option B (time-saver): 25 minute intervals", hint:"Pedal hard and fast for 1 minute, then easy for 2 minutes, and repeat."}
    ]
  },
  sat:{
    name:"Saturday", title:"Full-Body Athletic Mix + Core", sub:"Circuit day · 5 moves", type:"workout",
    circuitNote:"Do these 5 moves back-to-back with 30 seconds rest between moves. Rest 90 seconds after finishing all 5. Repeat 3 rounds.",
    equip:[
      ex("thrusters","Dumbbell Thrusters","Squat + overhead press","8-10 reps",
        ["Hold dumbbells at shoulders, squat down, and as you stand up, press the weights straight overhead in one smooth motion. Moderate weight."],
        [V("LA885CMp1yw","Form video")]),
      ex("pike-pushups","Pike Push-ups","Shoulders","6-10 reps",
        ["Hips high in an upside-down V. Lower your head toward the floor between your hands for 3 seconds, then push back up."],
        [V("shEnAXgc9y4","Form video")]),
      ex("rev-lunges","Dumbbell Reverse Lunges","Legs","8 reps per leg",
        ["Hold dumbbells at your sides, step backward into a lunge, and stand back up."],
        [V("Q2k3kYbtOcI","Form video")]),
      ex("archer-pushups","Archer Push-ups (controlled)","Chest & shoulders","4-5 reps per side",
        ["Start with hands wide. Lower toward one hand while the other arm stays long and straight, then push back up and switch sides.",
         "Ease in: do these slowly, keep the straight arm slightly bent, and make it easier with your knees down. Stop if your elbow or wrist feels sharp."],[]),
      ex("plank-taps","Plank with Shoulder Taps","Core & shoulder stability","20 taps (10 per side)",
        ["High plank with feet slightly wider than hips. Tap one shoulder with the opposite hand, keeping your hips from rocking. Alternate sides slowly."],[])
    ],
    body:[
      ex("bws-pushups","Push-ups","Chest & core","10-15 reps",
        ["Body straight from head to heels; drop to knees if form breaks."],
        [V("WDIpL0pjun0","Form video")]),
      ex("bws-squats","Squats","Legs","15 reps",
        ["Feet shoulder-width apart, sit back and down, chest tall."],
        [V("PlDqgNcJJ2U","Form video")]),
      ex("bws-archer","Archer Push-ups (controlled)","Chest & shoulders","4-5 reps per side",
        ["Hands wide. Lower toward one hand with the other arm long and straight, then push up and switch. Knees down to make it easier. Ease in and stop if a joint feels sharp."],[]),
      ex("bws-lunges","Reverse Lunges","Legs","8 reps per leg",
        ["Step backward into a lunge, lower with control, push back up."],
        [V("Q2k3kYbtOcI","Form video")]),
      ex("bws-taps","Plank with Shoulder Taps","Core & shoulder stability","20 taps (10 per side)",
        ["High plank, feet slightly wide. Tap each shoulder with the opposite hand without rocking your hips."],[])
    ],
    circuitNoteBody:"3 rounds: 10-15 push-ups, 15 squats, 4-5 archer push-ups per side, 8 reverse lunges per leg, 20 shoulder taps. Move straight through; rest as needed between rounds."
  }
};

/* ---------------- FOOD DATA ---------------- */

var HABITS = [
  {id:"h1", text:"Drank 3+ liters of water"},
  {id:"h2", text:"Hit protein at breakfast, lunch and dinner"},
  {id:"h3", text:"Zero sugary cold drinks or fried fast food"},
  {id:"h4", text:"Completed scheduled workout / cycling / football (or active rest)"},
  {id:"h5", text:"Dinner finished 2-3 hours before bed & asleep before midnight"}
];

var MEALS = [
  {id:"morning", name:"Morning", when:"on wake-up", items:[
    {id:"m1", text:"2 glasses of plain water + black coffee or plain tea (minimal sugar)"},
    {id:"m2", text:"Tuesday ride days: 1 banana or a few soaked almonds/dates with water, 15-20 min before riding"}
  ]},
  {id:"breakfast", name:"Breakfast", when:"high-protein start", items:[
    {id:"b1", text:"Option A: 3-4 whole eggs (boiled/omelette/bhurji) + 1-2 rotis or 2 whole-wheat toast slices"},
    {id:"b2", text:"Option B (veg): 1 bowl soaked moong/chana sprouts with onion/lemon + 1 bowl curd or 1 glass milk + 1-2 rotis"}
  ]},
  {id:"lunch", name:"Lunch", when:"fuel for the afternoon", items:[
    {id:"l1", text:"1-1.5 katori steamed rice (or 2-3 rotis)"},
    {id:"l2", text:"1 large bowl of thick dal"},
    {id:"l3", text:"Chicken curry (light oil) / fish / eggs / paneer / soya chunks + cooked sabzi + cucumber-tomato salad"}
  ]},
  {id:"snack", name:"Evening snack", when:"4:00 - 5:30 PM", items:[
    {id:"s1", text:"1 seasonal fruit (banana/apple/guava) + a handful of roasted chana, peanuts or makhana"},
    {id:"s2", text:"Week 3+ (Mon/Tue college days): 1 scoop whey in water around 3:30-4:30 PM to stop junk cravings"}
  ]},
  {id:"dinner", name:"Dinner", when:"light & early, 2-3 hours before sleep", items:[
    {id:"d1", text:"1-2 rotis (or 1 small katori rice) + chicken/eggs/fish/paneer/soya + plenty of cooked vegetables"},
    {id:"d2", text:"No heavy fried food, no sugary drinks, no late-night snacks"}
  ]}
];

var PROTEIN_SOURCES = [
  {n:"Whole eggs", d:"~6 g protein per egg - boiled, bhurji, or omelette with minimal oil."},
  {n:"Soya chunks", d:"~50 g protein per 100 g dry - soak, squeeze, add to sabzi, curry or rice."},
  {n:"Chicken breast / fish", d:"~25-30 g protein per 100 g cooked - light home-style gravy or pan-seared."},
  {n:"Paneer / curd / milk", d:"Great vegetarian protein and calcium sources."},
  {n:"Dal, chana & sprouts", d:"Steady protein + fiber to keep hunger low."},
  {n:"Roasted chana / makhana / peanuts", d:"Smart evening snacks instead of fried street food or sugary biscuits."}
];

var PHASES = [
  {id:"p1", fromWeek:1, toWeek:2, tag:"Weeks 1-2", name:"Zero supplements - foundation phase",
   lines:["Take nothing. Focus 100% on home food, water, sleep and building the workout habit.",
          "Let your stomach adjust to clean eating and learn to hit protein goals with real food first."]},
  {id:"p2", fromWeek:3, toWeek:4, tag:"Week 3 onward", name:"Whey protein - convenience",
   lines:["Start only after 2 consistent weeks of training and clean eating, when budget allows a reputable, lab-tested brand (skip ultra-cheap/unverified powders).",
          "1 scoop daily (~24-25 g protein) in 200-250 ml cold water.",
          "Best timing: within 30-60 min after training, or during afternoon college hours (Mon/Tue) in a shaker bottle."]},
  {id:"p3", fromWeek:5, toWeek:8, tag:"Week 5 onward", name:"Creatine monohydrate - strength & tone",
   lines:["Start after 1 full month of consistent workouts.",
          "3-5 g daily (1 small level scoop) every single day, including rest days. No loading phase needed.",
          "Anytime of day with a meal or post-workout shake. Creatine pulls water inside muscle cells (firmer, more defined look) - drink 3+ liters of water daily."]},
  {id:"p4", fromWeek:9, toWeek:999, tag:"Month 2+", name:"Optional health support - only if needed",
   lines:["Black coffee / plain tea 20-30 min before workouts or rides as a natural, cheap energy boost.",
          "Vitamin D3 + K2 / Omega-3 fish oil: optional if you get little morning sunlight or rarely eat fatty fish."]}
];

var SKIP = ["Fat burners","Testosterone boosters","Mass gainers","BCAA powders"];

/* ---------------- NAV ---------------- */

var ICONS = {
  home:'<svg viewBox="0 0 24 24"><path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10.5V20h11v-9.5"/></svg>',
  food:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/></svg>',
  habits:'<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  rides:'<svg viewBox="0 0 24 24"><circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8l2 8M9 8H7"/></svg>',
  progress:'<svg viewBox="0 0 24 24"><path d="M5 20v-6"/><path d="M10 20V5"/><path d="M15 20v-9"/><path d="M20 20v-4"/></svg>'
};

function nav(active){
  function item(href,key,label){
    return '<a href="'+href+'" class="bnav-item'+(active===key?' on':'')+'">'+ICONS[key]+'<span>'+label+'</span></a>';
  }
  return '<div class="topbar"><div class="wrap">' +
    '<a class="brand" href="index.html">ATHLETIC <span>&</span> LEAN</a>' +
    '</div></div>' +
    '<nav class="bnav">' +
      item('index.html','home','Home') +
      item('food.html','food','Food') +
      item('habits.html','habits','Habits') +
      item('rides.html','rides','Rides') +
      item('progress.html','progress','Progress') +
    '</nav>';
}

function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }

window.FT = {
  load:load, save:save, DAYS:DAYS, DAY_SHORT:DAY_SHORT,
  todayStr:todayStr, todayDayKey:todayDayKey, dayKeyOf:dayKeyOf, weekKey:weekKey,
  fmtDur:fmtDur, fmtClock:fmtClock, niceDate:niceDate,
  PLAN:PLAN, NOTES:NOTES, HABITS:HABITS, MEALS:MEALS,
  PROTEIN_SOURCES:PROTEIN_SOURCES, PHASES:PHASES, SKIP:SKIP,
  nav:nav, esc:esc
};
})();

