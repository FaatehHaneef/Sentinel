"use strict";
(() => {
  // engine/art/sprite.ts
  function withRows(base, changes) {
    return base.map((row, index) => changes[index] ?? row);
  }

  // engine/art/cog.ts
  var COG_PALETTE = {
    A: "#ffe08a",
    // antenna light
    a: "#8a7a5c",
    // antenna
    K: "#c9a24a",
    // brass
    k: "#9c7a2e",
    // brass shade
    L: "#ffb347",
    // lens
    l: "#e8743b",
    // lens ring
    D: "#2b2118",
    // dark detail
    G: "#6fae75",
    // indicator lights
    R: "#e05a6d",
    // warning light
    S: "#8fa3bf",
    // steel joints
    B: "#2e3a5c"
    // feet
  };
  var IDLE = [
    ".......A........",
    ".......a........",
    ".......a........",
    ".....KKKKKK.....",
    "....KKKKKKKK....",
    "...KKKllllKKK...",
    "...KKlLLLLlKK...",
    "...KKlLDDLlKK...",
    "...KKlLLLLlKK...",
    "...KKKllllKKK...",
    "....kKKKKKKk....",
    ".....SSSSSS.....",
    "...kKKKKKKKKk...",
    "..SkKKGKKGKKkS..",
    "..SkKKKKKKKKkS..",
    "..SkKDDDDDDKkS..",
    "..SkKKKKKKKKkS..",
    "...kKKKKKKKKk...",
    ".....SS..SS.....",
    ".....SS..SS.....",
    ".....SS..SS.....",
    "....kKK..KKk....",
    "...BBBB..BBBB...",
    "...BBBB..BBBB..."
  ];
  var COG_FRAMES = {
    idle: IDLE,
    walk1: withRows(IDLE, { 21: "....kKK...KKk...", 22: "...BBBB...BBBB..", 23: "...BBBB........." }),
    walk2: withRows(IDLE, { 21: "...kKK...KKk....", 22: "..BBBB...BBBB...", 23: ".........BBBB..." }),
    // Scanning: the lens narrows and the warning light comes on.
    worry: withRows(IDLE, { 0: ".......R........", 7: "...KKlDDDDlKK...", 13: "..SkKKRKKRKKkS.." }),
    // Puzzled: the head tilts and the antenna flickers.
    fuss: withRows(IDLE, {
      0: "........R.......",
      1: "........a.......",
      5: "...KKKKllllKK...",
      6: "...KKKlLLLLlK...",
      7: "...KKKlLDDLlK...",
      8: "...KKKlLLLLlK...",
      9: "...KKKKllllKK..."
    }),
    // Pleased: both lights green, arms raised.
    happy: withRows(IDLE, {
      0: ".......G........",
      12: "S..kKKKKKKKKk..S",
      13: "SSSkKKGKKGKKkSSS",
      14: "...kKKKKKKKKk..."
    })
  };

  // engine/art/dash.ts
  var DASH_PALETTE = {
    H: "#2b2118",
    // hair
    S: "#e2b08a",
    // skin
    s: "#c48e66",
    // skin shade
    E: "#12152a",
    // eyes
    M: "#7a3b2a",
    // mouth
    O: "#e8743b",
    // hoodie
    o: "#b9552a",
    // hoodie shade
    P: "#2e3a5c",
    // phone
    G: "#8fe0ff",
    // phone screen
    J: "#3a4a7a",
    // jeans
    W: "#f3e9d2",
    // trainers
    R: "#e05a6d"
    // trainer stripe
  };
  var IDLE2 = [
    "................",
    "....H.H.H.H.....",
    "....HHHHHHHH....",
    "...HHHHHHHHHH...",
    "...HSSSSSSSSH...",
    "...SSESSSSESS...",
    "...SSSSSSSSSS...",
    "...sSSSMMSSSs...",
    "....sSSSSSSs....",
    "...OOOOOOOOOO...",
    "..OOOOOOOOOOOO..",
    "..OOoOOOOOOoOO..",
    "..OOoOOOOOOoOSP.",
    "..OOoOOOOOOoOSG.",
    "..SOOOOOOOOOO.P.",
    "...oooooooooo...",
    "....JJJJJJJJ....",
    "....JJJJJJJJ....",
    "....JJJ..JJJ....",
    "....JJJ..JJJ....",
    "....JJJ..JJJ....",
    "...WWWW..WWWW...",
    "..WRWWW..WRWWW..",
    "..WWWWW..WWWWW.."
  ];
  var DASH_FRAMES = {
    idle: IDLE2,
    walk1: withRows(IDLE2, { 21: "...WWWW...WWWW..", 22: "..WRWWW...WRWWW.", 23: "..WWWWW........." }),
    walk2: withRows(IDLE2, { 21: "..WWWW...WWWW...", 22: ".WRWWW...WRWWW..", 23: ".........WWWWW.." }),
    // Checking the time, frowning.
    worry: withRows(IDLE2, {
      5: "...SSESSSSESS...",
      7: "...sSSMMMMSSs...",
      10: "..OOOOOOOOOOOOS.",
      11: "..OOoOOOOOOoOOP."
    }),
    // Tapping hard at the phone.
    fuss: withRows(IDLE2, { 11: "..OOoOOOOOOoOSP.", 12: "..OOoOOOOOOoOSG.", 13: "..OOoOOOOOOoO.P." }),
    // Pleased: phone raised.
    happy: withRows(IDLE2, {
      7: "...sSSMSSMSSs...",
      8: "....sSMMMMSs.P..",
      9: "...OOOOOOOOOOGS.",
      10: "..OOOOOOOOOOOOS.",
      12: "..OOoOOOOOOoOO..",
      13: "..OOoOOOOOOoOO.."
    })
  };

  // engine/art/echo.ts
  var ECHO_PALETTE = {
    P: "#e05a6d",
    // headphone band
    p: "#a83a4c",
    // ear cups
    H: "#3a2a20",
    // hair
    S: "#d9a67c",
    // skin
    s: "#b98558",
    // skin shade
    E: "#2b2118",
    // eyes
    M: "#7a3b2a",
    // mouth
    J: "#8fa3bf",
    // jumper
    j: "#6b7f9c",
    // jumper shade
    T: "#2e3a5c",
    // trousers
    B: "#12152a"
    // boots
  };
  var IDLE3 = [
    "................",
    ".....PPPPPP.....",
    "....PHHHHHHP....",
    "...PHHHHHHHHP...",
    "..ppHHHHHHHHpp..",
    "..ppSSSSSSSSpp..",
    "..ppSESSSSESpp..",
    "...SSSSSSSSSS...",
    "...sSSSMMSSSs...",
    "....sSSSSSSs....",
    "......SSSS......",
    "...JJJJJJJJJJ...",
    "..JJJJJJJJJJJJ..",
    "..JJjJJJJJJjJJ..",
    "..JJjJJJJJJjJJ..",
    "..JJjJJJJJJjJJ..",
    "..SSjJJJJJJjSS..",
    "...TTTTTTTTTT...",
    "...TTTTTTTTTT...",
    "...TTTT..TTTT...",
    "...TTTT..TTTT...",
    "...TTTT..TTTT...",
    "...BBBB..BBBB...",
    "..BBBBB..BBBBB.."
  ];
  var LISTENING = withRows(IDLE3, {
    5: "..ppSSSSSSSSppS.",
    6: "..ppSESSSSESppJ.",
    7: "...SSSSSSSSSS.J.",
    8: "...sSSSMMSSSs.J.",
    11: "...JJJJJJJJJJJJ.",
    16: "..SSjJJJJJJjJJ.."
  });
  var ECHO_FRAMES = {
    idle: IDLE3,
    walk1: withRows(IDLE3, { 22: "...BBBB...BBBB..", 23: "..BBBBB........." }),
    walk2: withRows(IDLE3, { 22: "..BBBB...BBBB...", 23: ".........BBBBB.." }),
    worry: LISTENING,
    // Puzzled: still listening, mouth open.
    fuss: withRows(LISTENING, { 8: "...sSSMMMMSSs.J." }),
    // Pleased: a smile.
    happy: withRows(IDLE3, { 7: "...SSMSSSSMSS...", 8: "...sSSMMMMSSs..." })
  };

  // engine/art/iris.ts
  var IRIS_PALETTE = {
    H: "#d5d5e0",
    // hair
    h: "#a3a3b8",
    // hair shade
    S: "#f2c9a0",
    // skin
    s: "#d9a67c",
    // skin shade
    G: "#2b2118",
    // glasses
    W: "#ffffff",
    // lens glint
    M: "#a0522d",
    // mouth
    A: "#ffb347",
    // shawl
    a: "#d98f2b",
    // shawl shade
    D: "#6b5b95",
    // dress
    d: "#4b3f6e",
    // dress shade
    B: "#3a2a20"
    // boots
  };
  var IDLE4 = [
    "................",
    "......HHHH......",
    ".....HHHHHH.....",
    "......HHHH......",
    "....HHHHHHHH....",
    "...HHHHHHHHHH...",
    "..HhSSSSSSSShH..",
    "..HSGGGSSGGGSH..",
    "..HSGWGGGGWGSH..",
    "..HSGGGSSGGGSH..",
    "...SSSSSSSSSS...",
    "...sSSSMMSSSs...",
    "....sSSSSSSs....",
    "...AAAAAAAAAA...",
    "..AAAAAAAAAAAA..",
    "..AAaAAAAAAaAA..",
    "..SAaAAAAAAaAS..",
    "...DDDDDDDDDD...",
    "...DDDDDDDDDD...",
    "...DdDDDDDDdD...",
    "..DDDDDDDDDDDD..",
    "..DdDDDDDDDDdD..",
    "....BB....BB....",
    "...BBB....BBB..."
  ];
  var IRIS_FRAMES = {
    idle: IDLE4,
    walk1: withRows(IDLE4, { 22: "....BB...BBB....", 23: "...BBB.........." }),
    walk2: withRows(IDLE4, { 22: "...BBB....BB....", 23: "..........BBB..." }),
    // Squinting: eyes narrowed to nothing behind the lenses, mouth tight.
    worry: withRows(IDLE4, { 8: "..HSGsGGGGsGSH..", 11: "...sSSMMMMSSs..." }),
    // Pushing her glasses up: glasses one row higher, one hand raised to them.
    fuss: withRows(IDLE4, {
      6: "..HhGGGSSGGGhH..",
      7: "..HSGWGGGGWGSHS.",
      8: "..HSGGGSSGGGSHS.",
      9: "..HSSSSSSSSSSHA.",
      10: "...SSSSSSSSSS.A.",
      11: "...sSSSMMSSSs.A.",
      12: "....sSSSSSSs..A.",
      13: "...AAAAAAAAAAAA.",
      16: "..SAaAAAAAAaAA.."
    }),
    // Pleased: a smile.
    happy: withRows(IDLE4, { 10: "...SSMSSSSMSS...", 11: "...sSSMMMMSSs..." })
  };

  // engine/art/knock.ts
  var KNOCK_PALETTE = {
    P: "#e8743b",
    // plume
    H: "#8fa3bf",
    // helm
    h: "#6b7f9c",
    // helm shade
    V: "#1b1f3b",
    // visor
    S: "#f2c9a0",
    // skin (eyes through the visor, hands)
    A: "#c9d3e2",
    // armour
    a: "#8fa3bf",
    // armour shade
    T: "#f3e9d2",
    // tabard
    K: "#ffb347",
    // emblem
    L: "#2e3a5c",
    // legs
    B: "#12152a"
    // boots
  };
  var IDLE5 = [
    "........PP......",
    ".......PPP......",
    ".....HHHHHH.....",
    "....HHHHHHHH....",
    "...HHHHHHHHHH...",
    "...HhhhhhhhhH...",
    "...HVVSVVSVVH...",
    "...HVVVVVVVVH...",
    "...HhHHHHHHhH...",
    "....HHHHHHHH....",
    ".....hhhhhh.....",
    "...AATTTTTTAA...",
    "..AAATTTTTTAAA..",
    "..AAATTKKTTAAA..",
    "..AAATTKKTTAAA..",
    "..aAATTTTTTAAa..",
    "..SS.TTTTTT.SS..",
    "....TTTTTTTT....",
    "....LLLLLLLL....",
    "....LLL..LLL....",
    "....LLL..LLL....",
    "....LLL..LLL....",
    "...BBBB..BBBB...",
    "..BBBBB..BBBBB.."
  ];
  var KNOCK_FRAMES = {
    idle: IDLE5,
    walk1: withRows(IDLE5, { 22: "...BBBB...BBBB..", 23: "..BBBBB........." }),
    walk2: withRows(IDLE5, { 22: "..BBBB...BBBB...", 23: ".........BBBBB.." }),
    // Knocking: one fist raised, then a little lower. The two frames alternate.
    worry: withRows(IDLE5, {
      13: "..AAATTKKTTAAASS",
      15: "..aAATTTTTTAA...",
      16: "..SS.TTTTTT....."
    }),
    fuss: withRows(IDLE5, {
      14: "..AAATTKKTTAAASS",
      15: "..aAATTTTTTAA...",
      16: "..SS.TTTTTT....."
    }),
    // Pleased: both arms up.
    happy: withRows(IDLE5, {
      10: "S....hhhhhh....S",
      11: "A..AATTTTTTAA..A",
      12: "AAAAATTTTTTAAAAA",
      16: ".....TTTTTT....."
    })
  };

  // engine/art/pell.ts
  var PELL_PALETTE = {
    H: "#5c4a3a",
    // hat
    h: "#44362a",
    // hat band
    S: "#c98e62",
    // skin
    s: "#a8744c",
    // skin shade
    E: "#2b2118",
    // eyes
    M: "#7a3b2a",
    // mouth
    C: "#8fa3bf",
    // coat
    c: "#6b7f9c",
    // coat shade
    P: "#6b4a2f",
    // pack
    p: "#4d3421",
    // pack straps
    G: "#ffb347",
    // phone glow
    T: "#2e3a5c",
    // trousers
    B: "#2b2118"
    // boots
  };
  var IDLE6 = [
    "................",
    "................",
    "......HHHH......",
    ".....HHHHHH.....",
    "..HHHHHHHHHHHH..",
    "....hhhhhhhh....",
    "....SSSSSSSS....",
    "....SESSSSES....",
    "....sSSSSSSs....",
    ".....sSSSSs.PPP.",
    "...CCCCCCCCPPPPP",
    "..CCCCCCCCCPPPPP",
    "..CCpCCCCpCPPPPP",
    "..CCpCCCCpCPPPPP",
    "..CCCCCCCCCPPPPP",
    "..SCCCCCCCCPPPP.",
    "..S.CCCCCCC.....",
    "....TTTTTTTT....",
    "....TTTTTTTT....",
    "....TTT..TTT....",
    "....TTT..TTT....",
    "....TTT..TTT....",
    "...BBBB..BBBB...",
    "..BBBBB..BBBBB.."
  ];
  var PELL_FRAMES = {
    idle: IDLE6,
    walk1: withRows(IDLE6, { 22: "...BBBB...BBBB..", 23: "..BBBBB........." }),
    walk2: withRows(IDLE6, { 22: "..BBBB...BBBB...", 23: ".........BBBBB.." }),
    // Holding up a phone that shows one bar.
    worry: withRows(IDLE6, {
      8: "..G.sSSSSSSs....",
      9: "..GS.sSSSSs.PPP.",
      10: "..SCCCCCCCCPPPPP",
      15: "...CCCCCCCCPPPP.",
      16: "....CCCCCCC....."
    }),
    // Sagging under the pack.
    fuss: withRows(IDLE6, {
      2: "................",
      3: "......HHHH......",
      4: ".....HHHHHH.....",
      5: "..HHHHHHHHHHHH..",
      6: "....hhhhhhhh....",
      7: "....SSSSSSSS....",
      8: "....sEssssEs.PPP",
      9: ".....sSSSSs.PPPP"
    }),
    // Pleased: hat raised.
    happy: withRows(IDLE6, {
      1: "..........HHHH..",
      2: ".........HHHHHH.",
      3: "......HHHHHHHH..",
      4: "....hhhhhhhhS...",
      5: "....SSSSSSSSS...",
      6: "....SSSSSSSSC...",
      7: "....SESSSSESC...",
      8: "....sSSMMSSsC..."
    })
  };

  // engine/art/tobin.ts
  var TOBIN_PALETTE = {
    C: "#6b4a2f",
    // cap
    c: "#4d3421",
    // cap brim
    S: "#f2c9a0",
    // skin
    s: "#d9a67c",
    // skin shade
    E: "#2b2118",
    // eyes
    W: "#f4f4f4",
    // moustache
    V: "#6fae75",
    // waistcoat
    v: "#4d8a57",
    // waistcoat buttons and shade
    R: "#f3e9d2",
    // shirt
    T: "#5c4a3a",
    // trousers
    t: "#44362a",
    // trouser shade
    B: "#2b2118"
    // boots
  };
  var IDLE7 = [
    "................",
    "................",
    ".....CCCCCC.....",
    "....CCCCCCCC....",
    "...CCCCCCCCCC...",
    "..cccccccccccC..",
    "...SSSSSSSSSS...",
    "...SESSSSSSES...",
    "...SSSSSSSSSS...",
    "...sWWWWWWWWs...",
    "...sSWSSSSWSs...",
    "....sSSSSSSs....",
    "...RVVVVVVVVR...",
    "..RRVVVVVVVVRR..",
    "..RRVvVVVVvVRR..",
    "..RRVVVVVVVVRR..",
    "..SRVvVVVVvVRS..",
    "...TTTTTTTTTT...",
    "...TTTTTTTTTT...",
    "...TTTT..TTTT...",
    "...TTTT..TTTT...",
    "...TtTT..TTtT...",
    "...BBBB..BBBB...",
    "..BBBBB..BBBBB.."
  ];
  var TOBIN_FRAMES = {
    idle: IDLE7,
    walk1: withRows(IDLE7, { 22: "...BBBB...BBBB..", 23: "..BBBBB........." }),
    walk2: withRows(IDLE7, { 22: "..BBBB...BBBB...", 23: ".........BBBBB.." }),
    // Hands held out, trembling: these two frames alternate quickly.
    worry: withRows(IDLE7, { 15: ".SRRVVVVVVVVRRS.", 16: "...RVvVVVVvVR..." }),
    fuss: withRows(IDLE7, { 14: "S.RRVvVVVVvVRR.S", 16: "...RVvVVVVvVR..." }),
    // Pleased: both hands up.
    happy: withRows(IDLE7, {
      11: "S...sSSSSSSs...S",
      12: "R..RVVVVVVVVR..R",
      13: "RRRRVVVVVVVVRRRR",
      16: "...RVvVVVVvVR..."
    })
  };

  // deck/cover/cover.ts
  var ART = {
    iris: { frames: IRIS_FRAMES, palette: IRIS_PALETTE },
    tobin: { frames: TOBIN_FRAMES, palette: TOBIN_PALETTE },
    pell: { frames: PELL_FRAMES, palette: PELL_PALETTE },
    knock: { frames: KNOCK_FRAMES, palette: KNOCK_PALETTE },
    echo: { frames: ECHO_FRAMES, palette: ECHO_PALETTE },
    dash: { frames: DASH_FRAMES, palette: DASH_PALETTE },
    cog: { frames: COG_FRAMES, palette: COG_PALETTE }
  };
  function paint(canvas, id, scale, flip) {
    const { frames, palette } = ART[id];
    const rows = frames.happy ?? frames.idle;
    canvas.width = rows[0].length * scale;
    canvas.height = rows.length * scale;
    const context = canvas.getContext("2d");
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const colour = palette[row[x]];
        if (!colour) continue;
        context.fillStyle = colour;
        const drawX = flip ? row.length - 1 - x : x;
        context.fillRect(drawX * scale, y * scale, scale, scale);
      }
    });
  }
  for (const canvas of document.querySelectorAll("canvas[data-who]")) {
    paint(canvas, canvas.dataset.who, Number(canvas.dataset.scale), canvas.dataset.flip === "1");
  }
  document.body.dataset.ready = "1";
})();
