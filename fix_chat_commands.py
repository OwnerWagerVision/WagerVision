from pathlib import Path
import re

p = Path("index.html")
text = p.read_text()

# Save real Edge Board picks globally
text = text.replace(
'''  picks.sort((a,b) => b.edge - a.edge);
  lastBoardPicks = picks;''',
'''  picks.sort((a,b) => b.edge - a.edge);
  lastBoardPicks = picks;
  window.wagerVisionPicks = picks;'''
)

start = text.find("  function buildHelpReply(){")
end = text.find("  async function insertChatRow", start)

if start == -1 or end == -1:
    print("Could not find chat command section.")
    raise SystemExit

new_section = '''  function buildHelpReply(){
    return [
      "WagerVision AI commands:",
      "@explain team — explains why the model likes or fades that team.",
      "@underdogs — shows plus-money dogs with positive edge.",
      "@best — shows the strongest current edges.",
      "Example: @explain jays"
    ].join("\\\\n");
  }

  function getRealPicks(){
    if(Array.isArray(window.wagerVisionPicks)) return window.wagerVisionPicks;
    if(typeof lastBoardPicks !== "undefined" && Array.isArray(lastBoardPicks)) return lastBoardPicks;
    return [];
  }

  function normalizeChatTeam(team){
    const q = String(team || "").toLowerCase().trim();
    const aliases = {
      jays: "blue jays",
      bluejays: "blue jays",
      toronto: "blue jays",
      yanks: "yankees",
      nyy: "yankees",
      sox: "red sox",
      bosox: "red sox",
      boston: "red sox",
      chisox: "white sox",
      cards: "cardinals",
      stl: "cardinals",
      dbacks: "diamondbacks",
      snakes: "diamondbacks",
      arizona: "diamondbacks",
      rocks: "rockies",
      colorado: "rockies",
      halos: "angels",
      atl: "braves",
      atlanta: "braves"
    };
    return aliases[q] || q;
  }

  function findRealPick(team){
    const target = normalizeChatTeam(team);
    const picks = getRealPicks();

    return picks.find(p => {
      const pick = String(p.pick || "").toLowerCase();
      const home = String(p.home || "").toLowerCase();
      const away = String(p.away || "").toLowerCase();

      return pick.includes(target) ||
             home.includes(target) ||
             away.includes(target) ||
             target.includes(pick);
    });
  }

  function confidenceLabel(edge){
    const e = Number(edge || 0);
    if(e >= 8) return "Strong Value";
    if(e >= 4) return "Lean";
    if(e <= -4) return "Fade/Check Away";
    return "Pass";
  }

  function buildExplainReply(team){
    const p = findRealPick(team);

    if(!p){
      return `I cannot find ${team} in the scanned Edge Board data yet. Load Games, Load Odds, run Scan Real Edge Board, then try @explain ${team} again.`;
    }

    const model = Number(p.model || 0);
    const market = Number(p.market || 0);
    const edge = Number(p.edge || 0);
    const line = Number(p.american || 0);

    let reply = `WagerVision read on ${p.pick}:\\\\n`;
    reply += `• Game: ${p.away} @ ${p.home}\\\\n`;
    reply += `• Model: ${model.toFixed(1)}%\\\\n`;
    reply += `• Market: ${market.toFixed(1)}%\\\\n`;
    reply += `• Edge: ${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%\\\\n`;
    reply += `• Line: ${displayAmerican(line)}${p.book ? " at " + p.book : ""}\\\\n`;
    reply += `• Confidence: ${confidenceLabel(edge)}\\\\n`;

    if(line > 0){
      reply += `• Dog status: Underdog price\\\\n`;
    }

    reply += `\\\\n`;

    if(edge >= 8){
      reply += `This is one of the stronger value spots because our model is well above the market number. `;
    } else if(edge >= 4){
      reply += `This is a playable lean because WagerVision has the probability higher than the market is pricing it. `;
    } else if(edge > 0){
      reply += `There is a small edge here, but not a hammer spot. `;
    } else {
      reply += `This is not showing clean value right now. `;
    }

    if(line > 0 && edge > 0){
      reply += `The book is still giving plus money while the model sees a better chance than the market implies. `;
    }

    reply += `Vegas prices the market. WagerVision prices the matchup.`;
    return reply;
  }

  function buildUnderdogsReply(){
    const dogs = getRealPicks()
      .filter(p => Number(p.american) > 0 && Number(p.edge) > 0)
      .sort((a,b) => Number(b.edge) - Number(a.edge))
      .slice(0, 6);

    if(!dogs.length){
      return "I do not see any plus-money WagerVision underdogs with positive edge yet. Run the Edge Board first, then type @underdogs again.";
    }

    const lines = dogs.map(p => {
      return `• ${p.pick} ${displayAmerican(p.american)} — model ${Number(p.model).toFixed(1)}%, market ${Number(p.market).toFixed(1)}%, edge ${Number(p.edge) >= 0 ? "+" : ""}${Number(p.edge).toFixed(1)}%`;
    });

    return "WagerVision underdog looks:\\\\n" + lines.join("\\\\n");
  }

  function buildBestReply(){
    const best = getRealPicks()
      .filter(p => Number(p.edge) > 0)
      .sort((a,b) => Number(b.edge) - Number(a.edge))
      .slice(0, 5);

    if(!best.length){
      return "I do not see positive-edge picks yet. Run the Edge Board first, then type @best again.";
    }

    const lines = best.map((p, i) => {
      const tag = i === 0 ? "⭐ " : "";
      return `• ${tag}${p.pick} ${displayAmerican(p.american)} — model ${Number(p.model).toFixed(1)}%, market ${Number(p.market).toFixed(1)}%, edge ${Number(p.edge) >= 0 ? "+" : ""}${Number(p.edge).toFixed(1)}%`;
    });

    return "Strongest WagerVision looks right now:\\\\n" + lines.join("\\\\n");
  }

  function getAIReply(msg){
    const lower = msg.toLowerCase().trim();

    if(lower === "@help") return buildHelpReply();
    if(lower === "@underdogs") return buildUnderdogsReply();
    if(lower === "@best") return buildBestReply();

    if(lower.startsWith("@explain ")){
      const team = msg.replace(/^@explain\\s+/i, "").trim();
      return buildExplainReply(team);
    }

    return null;
  }

'''

text = text[:start] + new_section + text[end:]
p.write_text(text)

print("Chat command section fixed and real pick data connected.")
