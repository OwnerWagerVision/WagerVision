const SUPABASE_URL = "https://zejuncnaujnofzzreaoo.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplanVuY25hdWpub2Z6enJlYW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM0MDgsImV4cCI6MjA5MzU2OTQwOH0.1JM5SWGZ2gpQhEm04gADhbLYnl-n86EXsAqn_hQMETM";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function updateLiveBar(payout, edge, confidence, legs){
  const payoutEl = document.getElementById("livePayout");
  const edgeEl = document.getElementById("liveEdge");
  const confidenceEl = document.getElementById("liveConfidence");
  const legsEl = document.getElementById("liveLegs");

  if(!payoutEl || !edgeEl || !confidenceEl || !legsEl) return;

  payoutEl.textContent = payout;
  edgeEl.textContent = edge;
  confidenceEl.textContent = confidence;
  legsEl.textContent = legs;
}

// your existing code continues below...

let loadedGames=[];
let selectedGamePk=null;
let selectedGameData=null;
let slip = JSON.parse(localStorage.getItem("wagervision_bet_slip")) || [];
let cachedOddsFeed = null;
let oddsLoadedForSession = false;

const savedUser = localStorage.getItem("wv_user");
if(savedUser){
  document.getElementById("signInBtn").textContent = savedUser.split("@")[0];
}

document.getElementById("gameDate").value=new Date().toISOString().split("T")[0];

function toggleInputs(){document.getElementById("inputsSection").classList.toggle("collapsed")}
function showTab(id,el){
  document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  el.classList.add("active");
}
function num(id){return Number(document.getElementById(id).value)}
function text(id){return document.getElementById(id).value.trim()}
function setVal(id,value){document.getElementById(id).value=value}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function toggleBase(id){document.getElementById(id).classList.toggle("on")}
function baseValue(){let v=0;if(base1.classList.contains("on"))v+=1;if(base2.classList.contains("on"))v+=1.4;if(base3.classList.contains("on"))v+=1.8;return v}
async function fetchJSON(url){const res=await fetch(url);if(!res.ok)throw new Error("network");return await res.json()}

async function saveApiKey() {
  const { data } = await supabaseClient.auth.getUser();

  if (!data.user) {
    alert("You must be signed in to save an API key.");
    document.getElementById("authModal").style.display = "flex";
    return;
  }

  const key = document.getElementById("oddsApiKey").value;

  if (!key) {
    document.getElementById("apiStatus").textContent = "Paste a key first.";
    return;
  }

  localStorage.setItem(`wagervision_odds_key_${data.user.id}`, key);
  document.getElementById("apiStatus").textContent = "API key saved.";
}

function clearApiKey(){localStorage.removeItem("wagervision_odds_key");setVal("oddsApiKey","");apiStatus.textContent="API key cleared."}
(async function(){
  const { data } = await supabaseClient.auth.getUser();

  if (!data.user) return;

  const key = localStorage.getItem("wagervision_odds_key");

  if (key) {
    setVal("oddsApiKey", key);
    document.getElementById("apiStatus").textContent = "API key loaded.";
  }
})();

function statValue(stats,name){try{return stats?.stats?.[0]?.splits?.[0]?.stat?.[name]??null}catch{return null}}
async function loadGames(){
  boardStatus.textContent="Loading MLB games...";
  loadStatus.textContent="Loading MLB games...";
  gameSelect.innerHTML="<option value=''>Loading...</option>";
  try{
    const data=await fetchJSON(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${gameDate.value}&hydrate=probablePitcher`);
    loadedGames=data.dates?.[0]?.games||[];
    gamesLoaded.textContent=loadedGames.length;
    if(!loadedGames.length){
      gameSelect.innerHTML="<option value=''>No games found</option>";
      boardStatus.textContent="No games found.";
      loadStatus.textContent="No games found.";
      return;
    }
    gameSelect.innerHTML=loadedGames.map((g,i)=>{
      const away=g.teams.away.team.name,home=g.teams.home.team.name;
      const ap=g.teams.away.probablePitcher?.fullName||"TBD";
      const hp=g.teams.home.probablePitcher?.fullName||"TBD";
      return `<option value="${i}">${away} @ ${home} · ${ap} vs ${hp}</option>`;
    }).join("");
    boardStatus.textContent=`${loadedGames.length} games loaded.`;
    loadStatus.textContent=`${loadedGames.length} games loaded. Pick one and use game.`;
  }catch{
    boardStatus.textContent="Could not load MLB games.";
    loadStatus.textContent="Could not load MLB games.";
  }
}

async function getTeamStats(teamId,season){
  const [hitting,pitching]=await Promise.all([
    fetchJSON(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=${season}`),
    fetchJSON(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=${season}`)
  ]);
  return{avg:Number(statValue(hitting,"avg"))||0.250,ops:Number(statValue(hitting,"ops"))||0.700,era:Number(statValue(pitching,"era"))||4.20,whip:Number(statValue(pitching,"whip"))||1.30};
}
async function getPitcherStats(playerId,season){
  if(!playerId)return null;
  try{
    const data=await fetchJSON(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=pitching&season=${season}`);
    const s=data?.stats?.[0]?.splits?.[0]?.stat;
    if(!s)return null;
    return{era:Number(s.era)||null,whip:Number(s.whip)||null};
  }catch{return null}
}
function ratePitcher(stats){
  if(!stats||!stats.era)return 5;
  const era=stats.era,whip=stats.whip||1.30;
  if(era<=2.75&&whip<=1.05)return 9;
  if(era<=3.35&&whip<=1.15)return 8;
  if(era<=3.90&&whip<=1.25)return 6;
  if(era<=4.60&&whip<=1.38)return 5;
  if(era<=5.20)return 3;
  return 2;
}

async function loadSelectedGame(){
  const index=gameSelect.value;
  if(index===""){loadStatus.textContent="Pick a game first.";return}
  const game=loadedGames[Number(index)];
  selectedGamePk=game.gamePk;
  selectedGameData=game;
  const season=new Date(gameDate.value).getFullYear();
  const home=game.teams.home.team,away=game.teams.away.team;

  loadStatus.textContent="Pulling team stats, pitcher stats, and live state...";
  try{
    const [hs,as,hp,ap]=await Promise.all([
      getTeamStats(home.id,season),
      getTeamStats(away.id,season),
      getPitcherStats(game.teams.home.probablePitcher?.id,season),
      getPitcherStats(game.teams.away.probablePitcher?.id,season)
    ]);

    setVal("homeTeam",home.name);setVal("awayTeam",away.name);
    setVal("homeAvg",hs.avg.toFixed(3));setVal("awayAvg",as.avg.toFixed(3));
    setVal("homeOps",hs.ops.toFixed(3));setVal("awayOps",as.ops.toFixed(3));
    setVal("homeEra",hs.era.toFixed(2));setVal("awayEra",as.era.toFixed(2));
    setVal("homePitcher",ratePitcher(hp));setVal("awayPitcher",ratePitcher(ap));

    await refreshLiveState(false);

    dataBox.innerHTML=`
      <strong>Live MLB Data Loaded</strong><br>
      ${away.name} @ ${home.name}<br>
      Away pitcher: ${game.teams.away.probablePitcher?.fullName||"TBD"}<br>
      Home pitcher: ${game.teams.home.probablePitcher?.fullName||"TBD"}<br><br>
      ${home.name}: AVG ${hs.avg.toFixed(3)}, OPS ${hs.ops.toFixed(3)}, ERA ${hs.era.toFixed(2)}, WHIP ${hs.whip.toFixed(2)}<br>
      ${away.name}: AVG ${as.avg.toFixed(3)}, OPS ${as.ops.toFixed(3)}, ERA ${as.era.toFixed(2)}, WHIP ${as.whip.toFixed(2)}
    `;
    loadStatus.textContent="Game loaded.";
    calculateOdds();
  }catch{
    loadStatus.textContent="Some stats failed. Using what is available.";
    calculateOdds();
  }
}

async function refreshLiveState(showMessage=true){
  if(!selectedGamePk){if(showMessage)loadStatus.textContent="Load a game first.";return}
  try{
    const data=await fetchJSON(`https://statsapi.mlb.com/api/v1.1/game/${selectedGamePk}/feed/live`);
    const l=data.liveData?.linescore;
    const homeRuns=Number(l?.teams?.home?.runs||0);
    const awayRuns=Number(l?.teams?.away?.runs||0);
    setVal("scoreLead",homeRuns-awayRuns);
    setVal("inning",clamp(Number(l?.currentInning||1),1,9));
    setVal("outs",clamp(Number(l?.outs||0),0,2));
    ["base1","base2","base3"].forEach(id=>document.getElementById(id).classList.remove("on"));
    if(l?.offense?.first)base1.classList.add("on");
    if(l?.offense?.second)base2.classList.add("on");
    if(l?.offense?.third)base3.classList.add("on");
    if(showMessage)loadStatus.textContent=`Live state updated: ${awayRuns}-${homeRuns}.`;
    calculateOdds();
  }catch{
    if(showMessage)loadStatus.textContent="Could not refresh live state.";
  }
}

function normalizeTeamName(name){return String(name||"").toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim()}
function americanToImplied(price){const p=Number(price);if(p>0)return(100/(p+100))*100;return((-p)/((-p)+100))*100}
function noVigTwoWay(a,b){const total=a+b;if(!total)return{a,b};return{a:(a/total)*100,b:(b/total)*100}}
function displayAmerican(price){const p=Number(price);return p>0?`+${p}`:`${p}`}
function decimalFromAmerican(price){const p=Number(price);if(p>0)return 1+(p/100);return 1+(100/Math.abs(p))}
async function getOddsFeed(){
const { data } = await supabaseClient.auth.getUser();

async function getOddsFeed(){
  const { data } = await supabaseClient.auth.getUser();

  if (!data.user) {
    alert("Please sign in to use live odds.");
    document.getElementById("authModal").style.display = "flex";
    throw new Error("User not signed in");
  }

  const key = text("oddsApiKey") || localStorage.getItem("wagervision_odds_key");

  if (!key) {
    throw new Error("No API key");
  }

  cachedOddsFeed = await fetchJSON(
    `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?regions=us&markets=h2h&oddsFormat=american&apiKey=${key}`
  );

  oddsLoadedForSession = true;

  return cachedOddsFeed;
}

  cachedOddsFeed = await fetchJSON(`https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?regions=us&markets=h2h&oddsFormat=american&apiKey=${key}`);

  oddsLoadedForSession = true;

  return cachedOddsFeed;
}

function findOddsGame(oddsFeed,homeName,awayName){
  const h=normalizeTeamName(homeName),a=normalizeTeamName(awayName);
  return oddsFeed.find(g=>{
    const gh=normalizeTeamName(g.home_team),ga=normalizeTeamName(g.away_team);
    return(gh.includes(h)||h.includes(gh)||ga.includes(a)||a.includes(ga));
  });
}
function bestHomeLineFromOddsGame(game){
  let best=null,bestBook="",bestProb=50,rows=[];
  if(!game)return null;
  game.bookmakers.forEach(book=>{
    const market=book.markets?.find(m=>m.key==="h2h");
    if(!market)return;
    const homeOutcome=market.outcomes.find(o=>normalizeTeamName(o.name)===normalizeTeamName(game.home_team));
    const awayOutcome=market.outcomes.find(o=>normalizeTeamName(o.name)===normalizeTeamName(game.away_team));
    if(!homeOutcome||!awayOutcome)return;
    const rawHome=americanToImplied(homeOutcome.price);
    const rawAway=americanToImplied(awayOutcome.price);
    const fair=noVigTwoWay(rawHome,rawAway);
    if(best===null||Number(homeOutcome.price)>Number(best)){
      best=homeOutcome.price;bestBook=book.title;bestProb=fair.a;
    }
    rows.push({book:book.title,homeLine:homeOutcome.price,awayLine:awayOutcome.price,homeProb:fair.a});
  });
  if(best===null)return null;
  return{best,bestBook,bestProb,rows};
}
async function loadOdds(){
  try{
    oddsBox.innerHTML=`<div class="data-box">Fetching sportsbook odds...</div>`;
    const feed=await getOddsFeed();
    const game=findOddsGame(feed,text("homeTeam"),text("awayTeam"));
    const info=bestHomeLineFromOddsGame(game);
    if(!info){oddsBox.innerHTML=`<div class="data-box">No matching odds found.</div>`;return}
    setVal("bookOdds",info.bestProb.toFixed(1));
    setVal("bestHomeLine",`${displayAmerican(info.best)} at ${info.bestBook}`);
    oddsBox.innerHTML=info.rows.map(row=>`
      <div class="book-row">
        <strong>${row.book}</strong>
        <div>Home ${displayAmerican(row.homeLine)}</div>
        <div>Fair ${row.homeProb.toFixed(1)}%</div>
      </div>
    `).join("");
    calculateOdds();
    loadStatus.textContent="Sportsbook odds loaded.";
  }catch{
    oddsBox.innerHTML=`<div class="data-box">Could not load odds. Check API key or request limit.</div>`;
  }
}

function modelCalc(input){
  let s=50,reasons=[];
  s+=4;reasons.push("Home field advantage added +4.");
  const avgImpact=(input.homeAvg-input.awayAvg)*130;s+=avgImpact;reasons.push(`Batting average impact: ${avgImpact>=0?"+":""}${avgImpact.toFixed(1)}.`);
  const opsImpact=(input.homeOps-input.awayOps)*45;s+=opsImpact;reasons.push(`OPS impact: ${opsImpact>=0?"+":""}${opsImpact.toFixed(1)}.`);
  let pitcherDiff=input.homePitcher-input.awayPitcher;let pitcherImpact=pitcherDiff*1.25;if(Math.abs(pitcherDiff)>=5)pitcherImpact=pitcherDiff>0?6:-6;if(pitcherImpact>6)pitcherImpact=6;if(pitcherImpact<-6)pitcherImpact=-6;s+=pitcherImpact;reasons.push(`Starting pitcher impact: ${pitcherImpact>=0?"+":""}${pitcherImpact.toFixed(1)}.`);
  const eraImpact=(input.awayEra-input.homeEra)*2.65;s+=eraImpact;reasons.push(`Team ERA impact: ${eraImpact>=0?"+":""}${eraImpact.toFixed(1)}.`);
  s+=input.homeInjuries;s-=input.awayInjuries;
  if(input.homeInjuries!==0)reasons.push(`Home injury penalty: ${input.homeInjuries}.`);
  if(input.awayInjuries!==0)reasons.push(`Away injury penalty benefits home by ${-input.awayInjuries}.`);
  const mult=input.inning>=8?4.5:input.inning>=7?3.8:input.inning>=5?2.8:2.0;
  const scoreImpact=input.scoreLead*mult;s+=scoreImpact;reasons.push(`Score per inning factor: ${scoreImpact>=0?"+":""}${scoreImpact.toFixed(1)}.`);
  const basePressure=input.baseValue*(3-input.outs)*0.85;s+=basePressure;
  if(input.baseValue>0)reasons.push(`Base runner pressure added +${basePressure.toFixed(1)}.`);
  if(input.inning>=8&&input.scoreLead>0){s+=4;reasons.push("Late-game lead bonus added +4.")}
  if(input.inning>=8&&input.scoreLead<0){s-=4;reasons.push("Late-game trailing penalty added -4.")}
  return{homeScore:clamp(s,2,98),reasons};
}
function currentInput(){
  return{
    homeAvg:num("homeAvg"),awayAvg:num("awayAvg"),
    homeOps:num("homeOps"),awayOps:num("awayOps"),
    homePitcher:num("homePitcher"),awayPitcher:num("awayPitcher"),
    homeEra:num("homeEra"),awayEra:num("awayEra"),
    homeInjuries:num("homeInjuries"),awayInjuries:num("awayInjuries"),
    inning:num("inning"),scoreLead:num("scoreLead"),baseValue:baseValue(),outs:num("outs")
  };
}
function parseBestHomeAmerican(){
  const match=text("bestHomeLine").match(/[+-]\d+/);
  return match?Number(match[0]):-110;
}
function calculateOdds(){
  const home=text("homeTeam")||"Home Team";
  const away=text("awayTeam")||"Away Team";
  const result=modelCalc(currentInput());

  const park = getParkFactor(selectedGameData?.venue?.name || "");
  let parkAdjustment = park.impact;
  if(parkAdjustment > 2) parkAdjustment = 2;
  if(parkAdjustment < -2) parkAdjustment = -2;
  result.homeScore += parkAdjustment;
  result.homeScore = clamp(result.homeScore,2,98);
  result.reasons.push(`Park factor impact (${park.type}): ${parkAdjustment>=0?"+":""}${parkAdjustment.toFixed(1)}.`);

  // Starting pitcher why logic
// Starting pitcher why logic
const homeStarter =
  selectedGameData?.teams?.home?.probablePitcher?.fullName || "";

const awayStarter =
  selectedGameData?.teams?.away?.probablePitcher?.fullName || "";
// Simple pitcher strength (temporary)
function getPitcherScore(name) {
  if (!name) return 0;

  // VERY basic logic (we upgrade later)
const aceList = [
  "Skubal", "Skenes", "Wheeler", "Sale", "Burnes",
  "Cole", "Gausman", "Strider", "Glasnow", "Cease",
  "Yamamoto", "Fried", "Ragans", "Gilbert", "Kirby",
  "Webb", "Valdez", "Castillo", "Luzardo", "Peralta",
  "Rodón", "Ryan", "Imanaga", "Greene", "Flaherty"
];
  const weakList = ["Bullpen", "TBD"];

  if (aceList.some(n => name.includes(n))) return 2;
  if (weakList.some(n => name.includes(n))) return -2;

  return 0;
}

const homePitcherRating = getPitcherScore(homeStarter);
const awayPitcherRating = getPitcherScore(awayStarter);
const pitcherEdge = homePitcherRating - awayPitcherRating;
console.log("PITCHER DEBUG:", {
  homeStarter,
  awayStarter,
  homePitcherRating,
  awayPitcherRating,
  pitcherEdge
});

result.reasons.push(
  `Starting pitchers: ${homeStarter} vs ${awayStarter}.`
);

if (Math.abs(pitcherEdge) >= 1.5) {
  result.reasons.push(
    `${pitcherEdge > 0 ? home : away} has the stronger starter on paper.`
  );
} else if (Math.abs(pitcherEdge) >= 0.5) {
  result.reasons.push(
    `Small starting pitcher lean toward ${pitcherEdge > 0 ? home : away}.`
  );
}

  const market=num("bookOdds");
  const edge=result.homeScore-market;
  const awayScore=100-result.homeScore;
  const pick=edge>=0?home:away;
  const american=parseBestHomeAmerican();

  winner.textContent=result.homeScore>=awayScore?home:away;
  probability.textContent=Math.round(Math.max(result.homeScore,awayScore))+"%";
  homeProb.textContent=result.homeScore.toFixed(1)+"%";
  marketProb.textContent=market.toFixed(1)+"%";
  edgeValue.textContent=(edge>=0?"+":"")+edge.toFixed(1)+"%";
  bar.style.width=result.homeScore+"%";

  let cls="edge-box",msg="";
  if(edge>=10){cls+=" green";msg=`STRONG VALUE on ${home}. Model ${result.homeScore.toFixed(1)}%, market ${market.toFixed(1)}%. The price looks wrong.`}
  else if(edge>=5){cls+=" yellow";msg=`LEAN ${home}. Positive edge, but not a cannon shot.`}
  else if(edge<=-10){cls+=" red";msg=`FADE ${home}. Market may be overpricing them.`}
  else if(edge<=-5){cls+=" yellow";msg=`LEAN ${away}. ${home} looks a little expensive.`}
  else{msg=`NO BET. Model and market are too close.`}
  edgeText.className=cls;edgeText.textContent=msg;


whyBox.innerHTML=`
  <strong>Why Panel</strong><br>
  Model Home Win: ${result.homeScore.toFixed(1)}%<br>
  Market Home Win: ${market.toFixed(1)}%<br>
  Edge: ${edge>=0?"+":""}${edge.toFixed(1)}%<br><br>
  ${result.reasons.map(r=>"• "+r).join("<br>")}
`;
  return{home,away,model:result.homeScore,market,edge,pick,american,book:text("bestHomeLine")};
}

async function scanBoard(){
  if(!loadedGames.length)await loadGames();
  if(!loadedGames.length)return;
  let oddsFeed=[];
  try{oddsFeed=await getOddsFeed()}catch{boardStatus.textContent="Need Odds API key saved in Settings to scan real edge.";return}

  boardStatus.textContent="Scanning full board with real sportsbook odds...";
  const season=new Date(gameDate.value).getFullYear();
  let picks=[];

  for(const game of loadedGames){
boardStatus.textContent = `Scanning ${picks.length + 1} of ${loadedGames.length} games...`;   
 try{
      const home=game.teams.home.team,away=game.teams.away.team;
      const [hs,as,hp,ap]=await Promise.all([
        getTeamStats(home.id,season),
        getTeamStats(away.id,season),
        getPitcherStats(game.teams.home.probablePitcher?.id,season),
        getPitcherStats(game.teams.away.probablePitcher?.id,season)
      ]);

      const model=modelCalc({
        homeAvg:hs.avg,awayAvg:as.avg,homeOps:hs.ops,awayOps:as.ops,
        homePitcher:ratePitcher(hp),awayPitcher:ratePitcher(ap),
        homeEra:hs.era,awayEra:as.era,
        homeInjuries:0,awayInjuries:0,inning:1,scoreLead:0,baseValue:0,outs:0
      });

      const oddsGame=findOddsGame(oddsFeed,home.name,away.name);
      const oddsInfo=bestHomeLineFromOddsGame(oddsGame);
      if(!oddsInfo)continue;

      const edge=model.homeScore-oddsInfo.bestProb;
      picks.push({
        home:home.name,away:away.name,
        model:model.homeScore,market:oddsInfo.bestProb,edge,
        american:oddsInfo.best,book:oddsInfo.bestBook,
        pick:edge>=0?home.name:away.name
      });
    }catch{}
  }

  picks.sort((a,b)=>b.edge-a.edge);
  if(picks.length)topEdge.textContent=(picks[0].edge>=0?"+":"")+picks[0].edge.toFixed(1)+"%";
  pickBoard.innerHTML=picks.length?picks.map((p,i)=>`
    <div class="pick-card">
      <div class="pick-top">
        <div>
          <div class="pick-title">${i===0?"⭐ ":i===1?"🔥 ":""}${p.away} @ ${p.home}</div>
          <div class="pick-meta">
            Pick: <strong>${p.pick}</strong><br>
            Model home: ${p.model.toFixed(1)}% · Market home: ${p.market.toFixed(1)}%<br>
            Best home line: ${displayAmerican(p.american)} at ${p.book}
          </div>
        </div>
        <div class="pick-edge ${p.edge<0?"bad":""}">${p.edge>=0?"+":""}${p.edge.toFixed(1)}%</div>
      </div>
      <div class="pill-row">
        <span class="pill">${p.edge>=8?"Strong Value":p.edge>=4?"Lean":p.edge<=-4?"Fade/Check Away":"Pass"}</span>
        <span class="pill">Real market edge</span>
      </div>
      <button class="gold" onclick='addPickToSlip(${JSON.stringify(p)})'>⭐ Add to Bet Slip</button>
    </div>
  `).join(""):`<div class="data-box">No matching odds found for today’s games.</div>`;
  boardStatus.textContent="Real edge board scanned.";
}

function saveSlip(){
  localStorage.setItem("wagervision_bet_slip", JSON.stringify(slip));
}

function addPickToSlip(p){
  slip.push(p);
  saveSlip();
  renderSlip();
  slipCount.textContent = slip.length;
  showTab("slip", document.querySelectorAll(".tab")[2]);
}

function addCurrentToSlip(){
  addPickToSlip(calculateOdds());
}

function clearSlip(){
  slip = [];
  localStorage.removeItem("wagervision_bet_slip");
  renderSlip();
  slipCount.textContent = 0;
}

function removeLeg(index){
  slip.splice(index, 1);
  saveSlip();
  renderSlip();
  slipCount.textContent = slip.length;
}

function renderSlip(){
updateLiveBar("0.00", "0%", "0%", slip.length);
  const stake=Number(document.getElementById("slipStake").value)||10;
  if(!slip.length){slipBox.innerHTML="No picks added yet. Add picks from Board or Game.";return}

  if(betMode.value==="single"){
    slipBox.innerHTML=slip.map((p,i)=>{
      const dec=decimalFromAmerican(p.american);
      const ret=stake*dec;
      const profit=ret-stake;
      return`
        <div class="leg">
          <div>
            <strong>${p.pick}</strong><br>
            <span class="small">${p.away} @ ${p.home} · ${displayAmerican(p.american)}<br>
            Stake $${stake.toFixed(2)} · Profit $${profit.toFixed(2)} · Return $${ret.toFixed(2)}</span>
          </div>
          <button class="remove" onclick="removeLeg(${i})">X</button>
        </div>
      `;
    }).join("");
    return;
  }

  const combinedDecimal=slip.reduce((total,p)=>total*decimalFromAmerican(p.american),1);
  const returnAmount=stake*combinedDecimal;
  const profit=returnAmount-stake;
  const avgEdge=slip.reduce((sum,p)=>sum+p.edge,0)/slip.length;
  const roughConfidence=slip.reduce((total,p)=>total*(Math.max(p.model,100-p.model)/100),1)*100;

updateLiveBar(
  returnAmount.toFixed(2),
  (avgEdge>=0?"+":"") + avgEdge.toFixed(1) + "%",
  roughConfidence.toFixed(1) + "%",
  slip.length
);

  slipBox.innerHTML=slip.map((p,i)=>`
    <div class="leg">
      <div>
        <strong>${p.pick}</strong><br>
        <span class="small">${p.away} @ ${p.home} · ${displayAmerican(p.american)} · Edge ${p.edge>=0?"+":""}${p.edge.toFixed(1)}%</span>
      </div>
      <button class="remove" onclick="removeLeg(${i})">X</button>
    </div>
  `).join("")+`
<div class="edge-box ${avgEdge>=5?"green":avgEdge>=2?"yellow":"red"}">
  <strong style="font-size:18px">💰 Potential Payout</strong><br><br>

  Stake: <strong>$${stake.toFixed(2)}</strong><br>
  Profit: <strong>$${profit.toFixed(2)}</strong><br>
  Total Return: <strong>$${returnAmount.toFixed(2)}</strong><br><br>

  Legs: ${slip.length}<br>
  Avg Edge: ${avgEdge>=0?"+":""}${avgEdge.toFixed(1)}%<br>
  Confidence: ${roughConfidence.toFixed(1)}%<br><br>

  ${slip.length>3
    ? "⚠️ Parlays get fragile after 3 legs."
    : "✔️ Solid leg count."}
</div>
  `;
}

calculateOdds();
document.getElementById("signInBtn").onclick = ()=>{
  document.getElementById("authModal").style.display = "flex";
};

function closeAuth(){
  document.getElementById("authModal").style.display = "none";
}

function handleLogin(){
  const email = document.getElementById("authEmail").value;
  if(!email) return alert("Enter email");

  localStorage.setItem("wv_user", email);
  document.getElementById("signInBtn").textContent = email.split("@")[0];

  closeAuth();
}

function getParkFactor(stadium){
  const parks = {
    "Coors Field": {type:"Hitter-friendly", impact:2},
    "Fenway Park": {type:"Hitter-friendly", impact:1.5},
    "Yankee Stadium": {type:"HR-friendly", impact:1.5},
    "Great American Ball Park": {type:"Hitter-friendly", impact:1.5},
    "Citizens Bank Park": {type:"Hitter-friendly", impact:1.2},

    "Oracle Park": {type:"Pitcher-friendly", impact:-1.5},
    "Petco Park": {type:"Pitcher-friendly", impact:-1.5},
    "T-Mobile Park": {type:"Pitcher-friendly", impact:-1.2},
    "Comerica Park": {type:"Pitcher-friendly", impact:-1.0}
  };

  return parks[stadium] || {type:"Neutral", impact:0};
}

document.getElementById("signInBtn").addEventListener("click", () => {
  document.getElementById("authModal").style.display = "flex";
});

function closeAuth() {
  document.getElementById("authModal").style.display = "none";
}

async function signUp() {
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;
  const status = document.getElementById("authStatus");

  const { error } = await supabaseClient.auth.signUp({
    email: email,
    password: password
  });

  status.textContent = error ? error.message : "Signup worked. Check your email.";
}

async function signIn() {
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;
  const status = document.getElementById("authStatus");

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

if (error) {
  status.textContent = error.message;
  return;
}

status.textContent = "Logged in.";
document.getElementById("signInBtn").textContent = `👤 ${email}`;
closeAuth();
}

async function signOut() {
  const status = document.getElementById("authStatus");

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    status.textContent = error.message;
    return;
  }

  status.textContent = "Logged out.";
  document.getElementById("signInBtn").textContent = "👤 Sign In";

  // clear bet slip from screen
  slip = [];
  renderSlip();
  slipCount.textContent = 0;

  // clear odds cache
  cachedOddsFeed = null;
  oddsLoadedForSession = false;

  closeAuth();
  showTab("game", document.querySelector(".tab"));
}

supabaseClient.auth.getUser().then(({ data }) => {
  if (data.user) {
    document.getElementById("signInBtn").textContent = `👤 ${data.user.email}`;
  } else {
    document.getElementById("signInBtn").textContent = "👤 Sign In";
  }
});
