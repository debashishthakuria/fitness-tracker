/* Athletic & Lean Tracker - shared data and helpers */
(function(){
"use strict";

var STORE_KEY = "ftStateV1";

function defState(){
  return {
    equipment: false,          // false = bodyweight starter, true = dumbbells + bar
    startDate: null,           // plan start date YYYY-MM-DD (for supplement phases)
    ticks: {},                 // "<week>|<day>|<itemId>" -> true
    habits: {},                // "<date>|<habitId>" -> true
    meals: {},                 // "<date>|<mealItemId>" -> true
    football: {},              // "<week>|<day>" -> true
    sessions: [],              // {date, day, seconds, ts}
    activeSession: null,       // {day, date, startTs}
    weights: []                // {date, kg}
  };
}

function load(){
  try{
    var raw = localStorage.getItem(STORE_KEY);
    if(!raw) return defState();
    var s = JSON.parse(raw);
    var d = defState();
    for(var k in d){ if(!(k in s)) s[k]=d[k]; }
    return s;
  }catch(e){ return defState(); }
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
  {t:"Rest time", d:"Rest 60-90 seconds between sets unless noted."},
  {t:"Weight selection", d:"Pick a weight where the last 2-3 reps feel hard without swinging your body or losing good posture."},
  {t:"Pull-up tip", d:"If full pull-ups feel too heavy right now, jump up so your chin is over the bar and lower yourself down as slowly as possible (3-5 seconds). Do 4-5 slow lowers per set."},
  {t:"How to progress", d:"Once you can hit the highest rep number cleanly on all sets, either slow the lowering phase to 3 seconds or add a 2 kg / 2.5 kg plate to your dumbbells."}
];

function ex(id,name,muscle,dose,steps,vids,group){
  return {id:id,name:name,muscle:muscle,dose:dose,steps:steps,vids:vids||[],group:group||null};
}
function V(id,label){ return {id:id,label:label}; }

var PLAN = {
  sun:{
    name:"Sunday", title:"Upper Body Push", sub:"Chest, shoulders, back of arms", type:"workout",
    equip:[
      ex("db-floor-press","Dumbbell Floor Press","Chest & arms","4 sets × 10-12 reps",
        ["Lie flat on your back on a folded bedsheet/rug with knees bent and feet flat on the floor.",
         "Hold a dumbbell in each hand, upper arms resting on the floor at a 45-degree angle from your body.",
         "Push the weights straight up toward the ceiling, then lower slowly until your elbows lightly touch the floor."],
        [V("Bx4QPVH-J1g","Form video")]),
      ex("pushups","Standard Push-ups","Chest & core","3 sets × max clean reps",
        ["Keep your body straight from head to heels, lower your chest close to the floor, and push back up.",
         "Drop to your knees to finish the set if your form breaks."],
        [V("WDIpL0pjun0","Form video")]),
      ex("db-shoulder-press","Dumbbell Shoulder Press","Shoulders","3 sets × 10-12 reps",
        ["Stand or sit tall holding a dumbbell in each hand at shoulder height with palms facing forward.",
         "Keep your stomach tight (do not arch your lower back) and press both weights straight overhead, then lower slowly."],
        [V("qEwKCR5JCog","Form video")]),
      ex("db-side-raises","Dumbbell Side Raises","Wide, defined shoulders","4 sets × 12-15 reps",
        ["Use lighter plates here. Stand tall with dumbbells at your sides, palms facing inward.",
         "With a slight bend in your elbows, raise both arms out to your sides up to shoulder height (like pouring water from jugs), pause briefly, and lower slowly."],
        [V("q9LhHrHShs4","Form video")]),
      ex("overhead-ext","Overhead Dumbbell Arm Extensions","Back of arms","3 sets × 12 reps",
        ["Hold ONE dumbbell with both hands above your head.",
         "Keep your upper arms close to your ears, bend your elbows to lower the weight behind your head, and straighten back up."],
        [V("X-iV-cG8cYs","Form video")])
    ],
    body:[
      ex("bw-pushups","Standard Push-ups","Chest & core","3 sets × max clean reps",
        ["Keep your body straight from head to heels, lower your chest close to the floor, and push back up.",
         "Drop to your knees to finish the set if your form breaks."],
        [V("WDIpL0pjun0","Form video")]),
      ex("bw-incline-pushups","Bed/Chair Elevated Push-ups","Chest & arms","3 sets × 10-12 reps",
        ["Place your hands on the edge of a sturdy bed or chair, body straight from head to heels.",
         "Lower your chest toward the edge and push back up."],
        [V("Z0bRiVhnO8Q","Form video")]),
      ex("bw-pike-pushups","Pike Push-ups","Shoulders","3 sets × 8-10 reps",
        ["Hips high so your body forms an upside-down V.",
         "Lower your head toward the floor between your hands, then push back up."],
        [V("shEnAXgc9y4","Form video")]),
      ex("bw-chair-dips","Chair Dips","Back of arms","3 sets × 10-12 reps",
        ["Hands on the edge of a sturdy chair or bed, legs out in front.",
         "Lower your body by bending the elbows, then push back up."],
        [V("Ol6IXTWZX5E","Form video")])
    ]
  },
  mon:{
    name:"Monday", title:"Rest & Reset", sub:"College day - recovery", type:"rest",
    items:[
      {id:"walk", text:"20-30 minute easy walk", hint:"Keep it relaxed - this is recovery."},
      {id:"stretch", text:"Light stretching at night", hint:"5-10 minutes is enough."},
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
    name:"Wednesday", title:"Upper Body Pull + Core", sub:"Back, front of arms, core", type:"workout",
    equip:[
      ex("pullups","Doorway Pull-ups or Chin-ups","Upper back & V-taper","4 sets × max reps",
        ["Grip the bar slightly wider than shoulders (palms facing away for pull-ups, or palms facing you for chin-ups).",
         "Pull your chest up toward the bar without kicking your legs, and lower all the way down with control (or do 4-5 slow lowers)."],
        [V("I3vH43n7n2Q","Pull-up form"), V("gbPURTSxQLY","Slow lowers (beginner)")]),
      ex("one-arm-row","One-Arm Dumbbell Row","Mid-back cuts","3 sets × 10-12 reps per arm",
        ["Place one knee and one hand on your bed or a sturdy chair so your back is flat like a tabletop.",
         "Pull a heavy dumbbell up toward your hip/waist (keep elbow tucked close to your body), squeeze your back, and lower slowly."],
        [V("epSR-ma7BsY","Form video")]),
      ex("rear-raises","Bent-Over Rear Shoulder Raises","Posture & upper back","3 sets × 12-15 reps",
        ["Use lighter weights. Push your hips back and lean forward until your torso is nearly flat, keeping your back straight.",
         "Raise your arms out to the sides like wings, squeezing your shoulder blades together, then lower slowly."],
        [V("rQhdsa5QdVU","Form video")]),
      ex("curls","Dumbbell Bicep Curls + Hammer Curls","Front of arms","3 sets × 10-12 reps each",
        ["Keep elbows pinned at your sides without swinging.",
         "Do 10-12 reps with palms facing forward (bicep curls), then 10-12 reps with palms facing each other (hammer curls)."],
        [V("b0pZWf3vfRk","Bicep curl form"), V("zC3nLlEvin4","Hammer curl form")]),
      ex("knee-raises","Hanging Knee Raises","Core","10-12 reps",
        ["Hang from the pull-up bar with straight arms and lift knees toward your chest without swinging."],
        [V("G6a5267YpHM","Form video")], "Core circuit - 3 rounds (rest 45 seconds between rounds)"),
      ex("plank","Forearm Plank","Core","Hold 45-60 seconds",
        ["Stomach tight, hips flat, shoulders over elbows."],
        [V("wCBOqf-HrTI","Form video")], "Core circuit - 3 rounds (rest 45 seconds between rounds)"),
      ex("russian-twists","Russian Twists","Core","16 twists total (8 per side)",
        ["Sit with knees bent, lean back slightly with a straight back, holding 1 light plate/dumbbell.",
         "Rotate smoothly side to side."],
        [V("wkD8rjkodUI","Form video")], "Core circuit - 3 rounds (rest 45 seconds between rounds)")
    ],
    body:[
      ex("bw-table-rows","Under-Table Rows","Back & arms","4 sets × 8-12 reps",
        ["Lie under a sturdy table, grip the edge, and pull your chest up to it. Lower with control."],
        [V("OYUxXMGVuuU","Form video")]),
      ex("bw-towel-pulls","Floor Towel Pulls","Back","3 sets × 12 reps",
        ["Lie on your stomach holding a rolled towel wide overhead.",
         "Pull the towel down to your chin, squeezing your shoulder blades, then extend back up."],
        [V("L-2kwLbvTQo","Form video")]),
      ex("bw-doorframe-rows","Doorframe Rows","Back","3 sets × 12 reps per side",
        ["Stand in a doorway holding the frame edge, lean back with straight arms, and pull your body in."],
        [V("yeJARDrk1R8","Form video")]),
      ex("bw-plank","Forearm Plank","Core","45 seconds",
        ["Stomach tight, hips flat."],
        [V("wCBOqf-HrTI","Form video")], "Core - 3 rounds"),
      ex("bw-leg-raises","Lying Leg Raises","Core","12 reps",
        ["Lie on your back, legs straight, lower them slowly without touching the floor."],
        [V("0tzBVqiDwSs","Form video")], "Core - 3 rounds"),
      ex("bw-bicycle","Bicycle Crunches","Core","16 reps",
        ["Alternate elbow to opposite knee in a smooth pedalling motion."],
        [V("wpRI3xBhJmo","Form video")], "Core - 3 rounds")
    ]
  },
  thu:{
    name:"Thursday", title:"Legs & Lower Body", sub:"Thighs, glutes, calves", type:"workout",
    equip:[
      ex("goblet-squats","Goblet Squats","Thighs & glutes","4 sets × 12-15 reps",
        ["Hold one heavy dumbbell vertically against your chest with both hands.",
         "Feet shoulder-width apart; sit your hips back and down as low as comfortable while keeping chest tall and heels flat, then push through your heels to stand up."],
        [V("9KzZD_n2r64","Form video")]),
      ex("db-rdl","Dumbbell Romanian Deadlifts","Back of thighs","3 sets × 12 reps",
        ["Hold dumbbells in front of your thighs with knees slightly unlocked (not stiff).",
         "Keep your back completely flat and push your hips straight backward, lowering the weights along your shins until you feel a deep stretch in the back of your thighs, then stand tall."],
        [V("hu3jRvTc_po","Form video")]),
      ex("split-squats","Split Squats","Single-leg strength","3 sets × 10 reps per leg",
        ["Hold dumbbells at your sides, take a long step forward with one foot, and lower your back knee straight down toward the floor until both knees reach 90 degrees.",
         "Push through the front heel to stand back up."],
        [V("m8mQ_92_Ylg","Form video")]),
      ex("calf-raises","Weighted Calf Raises","Lower legs","3 sets × 15-20 reps",
        ["Hold dumbbells at your sides, rise high onto your tiptoes, pause 1 full second at the top, and lower heels slowly."],
        [V("k8ipHzKeAkQ","Form video")])
    ],
    body:[
      ex("bw-squats","Bodyweight Squats","Thighs & glutes","4 sets × 15-20 reps",
        ["Feet shoulder-width apart, sit your hips back and down, chest tall, heels flat."],
        [V("PlDqgNcJJ2U","Form video")]),
      ex("bw-rev-lunges","Reverse Lunges","Legs","3 sets × 10 reps per leg",
        ["Step backward into a lunge, lower until both knees are near 90 degrees, push back up."],
        [V("Q2k3kYbtOcI","Form video")]),
      ex("bw-glute-bridges","Glute Bridges","Glutes","3 sets × 15 reps",
        ["Lie on your back, knees bent, drive your hips up and squeeze at the top."],
        [V("wPM8icPu6H8","Form video")]),
      ex("bw-calf-raises","Standing Calf Raises","Calves","3 sets × 20 reps",
        ["Rise high onto your tiptoes, pause 1 second at the top, lower slowly."],
        [V("k8ipHzKeAkQ","Form video")])
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
    name:"Saturday", title:"Full-Body Athletic Mix + Core", sub:"Circuit day", type:"workout",
    circuitNote:"Do these 5 moves back-to-back with 30 seconds rest between moves. Rest 90 seconds after finishing all 5. Repeat 3 rounds.",
    equip:[
      ex("thrusters","Dumbbell Thrusters","Squat + overhead press","10-12 reps",
        ["Hold dumbbells at shoulders, squat down, and as you stand up, press the weights straight overhead in one smooth motion."],
        [V("LA885CMp1yw","Form video")]),
      ex("renegade-rows","Renegade Rows","Push-up position row","8 reps per arm",
        ["Get into a push-up position holding onto your dumbbells on the floor (widen feet for balance).",
         "Pull one dumbbell to your hip without twisting your hips, lower it, and switch arms."],
        [V("Q28cLuweLv4","Form video")]),
      ex("sat-pushups","Standard Push-ups","Chest & core","10-15 clean reps",
        ["Body straight from head to heels; drop to knees if form breaks."],
        [V("WDIpL0pjun0","Form video")]),
      ex("rev-lunges","Dumbbell Reverse Lunges","Legs","8 reps per leg",
        ["Hold dumbbells at your sides, step backward into a lunge, and stand back up."],
        [V("Q2k3kYbtOcI","Form video")]),
      ex("sat-core","Hanging Knee Raises or Lying Leg Raises","Core","12-15 reps",
        ["Pick the bar version or the floor version - keep it controlled, no swinging."],
        [V("G6a5267YpHM","Knee raises"), V("0tzBVqiDwSs","Leg raises")])
    ],
    body:[
      ex("bws-pushups","Push-ups","Chest & core","10-15 reps",
        ["Body straight from head to heels; drop to knees if form breaks."],
        [V("WDIpL0pjun0","Form video")]),
      ex("bws-squats","Squats","Legs","15 reps",
        ["Feet shoulder-width apart, sit back and down, chest tall."],
        [V("PlDqgNcJJ2U","Form video")]),
      ex("bws-climbers","Mountain Climbers","Core & conditioning","30 seconds",
        ["Push-up position, drive knees to chest fast while keeping hips level."],
        [V("cnyTQDSE884","Form video")]),
      ex("bws-lunges","Reverse Lunges","Legs","8 reps per leg",
        ["Step backward into a lunge, lower with control, push back up."],
        [V("Q2k3kYbtOcI","Form video")]),
      ex("bws-plank","Plank","Core","45 seconds",
        ["Stomach tight, hips flat."],
        [V("wCBOqf-HrTI","Form video")])
    ],
    circuitNoteBody:"3 rounds: 10-15 push-ups, 15 squats, 30s mountain climbers, 8 reverse lunges per leg, 45s plank. Move straight through; rest as needed between rounds."
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

function nav(active){
  return '<div class="topbar"><div class="wrap">' +
    '<div class="brand">ATHLETIC <span>&</span> LEAN</div>' +
    '<nav class="topnav">' +
      '<a href="index.html"'+(active==="home"?' class="on"':'')+'>Home</a>' +
      '<a href="food.html"'+(active==="food"?' class="on"':'')+'>Food</a>' +
      '<a href="habits.html"'+(active==="habits"?' class="on"':'')+'>Habits</a>' +
      '<a href="progress.html"'+(active==="progress"?' class="on"':'')+'>Progress</a>' +
    '</nav></div></div>';
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
