"""Player and villager sprites (16x24 frames, hand-placed pixels)."""
from pix import parse, blank, paste, flip, outline, hex2rgba, PAL
from PIL import Image, ImageDraw

W, H = 16, 24

HAT = [
    "................",
    "................",
    ".....oooooo.....",
    "....oaaaaaAo....",
    "...oaaaaaaaAo...",
    "...orrrrrrrRo...",
    ".ooaaaaaaaaaAoo.",
    "oaaaaaaaaaaaaaAo",
    ".occcccccccccco.",
]

FACE_FRONT = {
    'normal': [
        "..oHHHHHHHHHHo..",
        "..oHhHssssHhHo..",
        "..oHsessssesHo..",
        "..oHsessssesHo..",
        "..oskssmmsskso..",
        "...osssssssso...",
    ],
    'happy': [
        "..oHHHHHHHHHHo..",
        "..oHhHssssHhHo..",
        "..oHsessssesHo..",
        "..oHesesseseHo..",
        "..oskssmmsskso..",
        "...ossmmmmsso...",
    ],
    'strain': [
        "..oHHHHHHHHHHo..",
        "..oHhHssssHhHo..",
        "..oHesssssseHo..",
        "..oHsessssesHo..",
        "..oskseeeeskso..",
        "...osssssssso...",
    ],
    'panic': [
        "..oHHHHHHHHHHo..",
        "..oHhHssssHhHo..",
        "..oHeesssseeHo..",
        "..oHeEssssEeHo..",
        "..oskssmmsskso..",
        "...osssmmssso...",
    ],
    'dazed': [
        "..oHHHHHHHHHHo..",
        "..oHhHssssHhHo..",
        "..oHssssssssHo..",
        "..oHeesssseeHo..",
        "..oskssssssko...".ljust(16, '.'),
        "...ossmmmmsso...",
    ],
    'worried': [
        "..oHHHHHHHHHHo..",
        "..oHhHssssHhHo..",
        "..oHsessssesHo..",
        "..oHsessssesHo..",
        "..oskssssssk so.".replace(' ', 's'),
        "...osssmmssso...",
    ],
}

FACE_SIDE = {
    'normal': [
        "...oHHHHHHHHHo..",
        "...oHHHHHhsssso.",
        "...oHHHsssseso..",
        "...oHHHsssseso..",
        "...oHHHsssksso..",
        "....oHHssssmo...",
    ],
    'happy': [
        "...oHHHHHHHHHo..",
        "...oHHHHHhsssso.",
        "...oHHHssssseo..",
        "...oHHHsssseso..",
        "...oHHHsssksmo..",
        "....oHHsssmmo...",
    ],
    'strain': [
        "...oHHHHHHHHHo..",
        "...oHHHHHhsssso.",
        "...oHHHssssseo..",
        "...oHHHsssseso..",
        "...oHHHsssseeo..",
        "....oHHssssso...",
    ],
    'panic': [
        "...oHHHHHHHHHo..",
        "...oHHHHHhsssso.",
        "...oHHHssseeso..",
        "...oHHHssseEso..",
        "...oHHHssskmmo..",
        "....oHHsssssmo..",
    ],
}
FACE_SIDE['worried'] = FACE_SIDE['normal']
FACE_SIDE['dazed'] = [
    "...oHHHHHHHHHo..",
    "...oHHHHHhsssso.",
    "...oHHHssssso...",
    "...oHHHssseeso..",
    "...oHHHsssksso..",
    "....oHHssssmo...",
]

BACK_HEAD = [
    "..oHHHHHHHHHHo..",
    "..oHhHHHHHHhHo..",
    "..oHHHHhHHHHHo..",
    "..oHHHHHHHHHHo..",
    "..osHHHHHHHHso..",
    "...oHHHHHHHHo...",
]

BODY_FRONT = [
    "...owwbbbbwwo...",
    "..owwbnbbnbwwo..",
    "..oWwbbbbbbwWo..",
    "..osBbbbbbbBso..",
    "...oBbbbbbbBo...",
]
BODY_FRONT_UP = [  # arms raised (hands drawn separately)
    "...owwbbbbwwo...",
    "...owbnbbnbwo...",
    "...oWbbbbbbWo...",
    "...oBbbbbbbBo...",
    "...oBbbbbbbBo...",
]
BODY_BACK = [
    "...owwbwwbwwo...",
    "..owwwbwwbwwwo..",
    "..oWwwbwwbwwWo..",
    "..osBbbbbbbBso..",
    "...oBbbbbbbBo...",
]
BODY_SIDE = [
    "....owwbbbbo....",
    "....owWwbnbo....",
    "....oBWwbbbo....",
    "....oBbsbbBo....",
    "....oBbbbbBo....",
]
BODY_SIDE_SWING = [
    "....owwbbbbo....",
    "....owwWwnbo....",
    "....oBbWwbbo....",
    "....oBbbsbBo....",
    "....oBbbbbBo....",
]

LEGS_FRONT = {
    'idle': [
        "....oBbbbbbBo...",
        "....oBboobBo....",
        "....offooffo....",
        "....oooooooo....",
    ],
    'stepA': [
        "....oBbbbbbBo...",
        "....oBboffo.....",
        "....offooooo....",
        "....oooo........",
    ],
}
LEGS_FRONT['stepB'] = [r[::-1] for r in LEGS_FRONT['stepA']]
# fix: mirror keeps 16 width but shifts the crotch row by one; rebuild row 0
LEGS_FRONT['stepB'][0] = LEGS_FRONT['stepA'][0]

LEGS_SIDE = {
    'idle': [
        ".....oBbbBo.....",
        ".....oBbbBo.....",
        ".....offfffo....",
        ".....oooooo.....",
    ],
    'stepA': [
        "....oBbbbbBo....",
        "...oBbo.oBbo....",
        "..offo...offfo..",
        "..oooo...ooooo..",
    ],
    'stepB': [
        "....oBbbbbBo....",
        "...obBo.obBo....",
        "..offo...offfo..",
        "..oooo...ooooo..",
    ],
}

SIT_LEGS = [
    "..oBbbbbbbbbBo..",
    "..offo....offo..",
    "..oooo....oooo..",
]


def rows_img(rows):
    return parse([r[:16].ljust(16, '.') for r in rows])


def compose(head_rows, body_rows, leg_rows, bob=0):
    """Stack head(9 hat + 6 face rows) + body(5) + legs(4) = 24 rows; bob lifts upper body."""
    img = blank(W, H)
    upper = parse(HAT + head_rows + body_rows)  # 20 rows
    legs = parse(leg_rows)
    paste(img, legs, 0, 20)
    if bob:
        # fill the gap left by lifting with a copy of the pants row
        gap = parse([body_rows[-1]])
        paste(img, gap, 0, 19)
    paste(img, upper, 0, -bob)
    return img


def sack_img(level, view):
    """Burlap sack blob. level 0..4; view: 'back' | 'front' | 'side'."""
    sizes = {0: (6, 5), 1: (8, 7), 2: (10, 9), 3: (12, 10), 4: (14, 12)}
    w, h = sizes[level]
    img = blank(w + 2, h + 4)
    px = img.load()
    cx, cy = (w + 1) / 2, (h + 3) / 2 + 1
    rx, ry = w / 2, h / 2
    base, shade, dark, tie = hex2rgba(PAL['g']), hex2rgba(PAL['G']), hex2rgba(PAL['j']), hex2rgba(PAL['J'])
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d <= 1.0:
                c = base
                if dx > 0.35 or dy > 0.45:
                    c = shade
                if dx > 0.6 and dy > 0.2 or dy > 0.8:
                    c = dark
                if -0.55 < dx < -0.15 and -0.6 < dy < -0.2:
                    c = hex2rgba(PAL['Y'])
                px[x, y] = c
    # tied neck on top
    nx = int(cx)
    for y in range(0, int(cy - ry) + 1):
        for x in (nx - 1, nx):
            if 0 <= x < img.size[0]:
                px[x, y] = tie
    # stitch marks
    if level >= 2:
        for i in range(-1, 2):
            sx = int(cx + i * rx * 0.45)
            sy = int(cy + ry * 0.15)
            if 0 <= sx < img.size[0]:
                px[sx, sy] = dark
    img = outline(img)
    if level == 4:  # overflowing: a shell and a stick poke out
        shell = parse(["oIIo", "oiIo", ".oo."])
        stick = parse(["o3", "32", "3o"])
        big = blank(img.size[0] + 2, img.size[1] + 2)
        paste(big, stick, 4, 2)
        paste(big, shell, big.size[0] - 8, 2)
        paste(big, img, 1, 2)
        paste(big, stick.crop((0, 0, 2, 2)), 4, 2)
        paste(big, shell.crop((0, 0, 4, 2)), big.size[0] - 8, 2)
        img = big
    return img


def player_frames():
    frames = {}
    faces = list(FACE_FRONT.keys())
    # front (down)
    for f in faces:
        frames[f'p_down_idle0_{f}'] = compose(FACE_FRONT[f], BODY_FRONT, LEGS_FRONT['idle'])
        frames[f'p_down_idle1_{f}'] = compose(FACE_FRONT[f], BODY_FRONT, LEGS_FRONT['idle'], bob=1)
        seq = [('stepA', 0), ('idle', 1), ('stepB', 0), ('idle', 1)]
        for i, (lg, bob) in enumerate(seq):
            frames[f'p_down_walk{i}_{f}'] = compose(FACE_FRONT[f], BODY_FRONT, LEGS_FRONT[lg], bob=bob)
    # back (up)
    frames['p_up_idle0'] = compose(BACK_HEAD, BODY_BACK, LEGS_FRONT['idle'])
    frames['p_up_idle1'] = compose(BACK_HEAD, BODY_BACK, LEGS_FRONT['idle'], bob=1)
    for i, (lg, bob) in enumerate([('stepA', 0), ('idle', 1), ('stepB', 0), ('idle', 1)]):
        frames[f'p_up_walk{i}'] = compose(BACK_HEAD, BODY_BACK, LEGS_FRONT[lg], bob=bob)
    # side (right); left is mirrored at runtime
    for f in FACE_SIDE:
        frames[f'p_side_idle0_{f}'] = compose(FACE_SIDE[f], BODY_SIDE, LEGS_SIDE['idle'])
        frames[f'p_side_idle1_{f}'] = compose(FACE_SIDE[f], BODY_SIDE, LEGS_SIDE['idle'], bob=1)
        seq = [('stepA', 0, BODY_SIDE_SWING), ('idle', 1, BODY_SIDE), ('stepB', 0, BODY_SIDE_SWING), ('idle', 1, BODY_SIDE)]
        for i, (lg, bob, body) in enumerate(seq):
            frames[f'p_side_walk{i}_{f}'] = compose(FACE_SIDE[f], body, LEGS_SIDE[lg], bob=bob)
    # cheer: arms up (front, happy) two frames
    for i in range(2):
        img = compose(FACE_FRONT['happy'], BODY_FRONT_UP, LEGS_FRONT['idle'], bob=i)
        arm = parse(["so..", "wso.", ".wwo", "..wo"])
        armr = flip(arm)
        paste(img, arm, 0, 12 - i)
        paste(img, armr, 12, 12 - i)
        frames[f'p_cheer{i}'] = img
    # flail (swept): panic face, arms up
    for i in range(2):
        img = compose(FACE_FRONT['panic'], BODY_FRONT_UP, LEGS_FRONT['stepA' if i == 0 else 'stepB'])
        arm = parse(["so", "sw", "ow", ".w"])
        paste(img, arm if i == 0 else parse(["os", "ws", "wo", "wo"]), 1, 10 + i)
        paste(img, flip(arm), 13, 11 - i)
        frames[f'p_flail{i}'] = img
    # sit (washed ashore): dazed face lowered, legs forward
    for i in range(2):
        img = blank(W, H)
        upper = parse(HAT + FACE_FRONT['dazed' if i == 0 else 'happy'] + BODY_FRONT)
        paste(img, parse(SIT_LEGS), 0, 21)
        paste(img, upper, 0, 2 + (1 if i == 1 else 0) - 1)
        frames[f'p_sit{i}'] = img
    return frames


def sack_frames():
    out = {}
    for lv in range(5):
        out[f'sack{lv}'] = sack_img(lv, 'back')
    return out


# ---------------- villagers ----------------
GRANNY = {
    'idle0': [
        "................",
        "................",
        "................",
        "......oooo......",
        "....oowwwwoo....",
        "...owwwwwwwWo...",
        "...owWwwwwwWo...",
        "..owwWWWWWWwwo..",
        "..owsssssssSwo..",
        "..oWseesseesWo..",
        "..oWsssssssSWo..",
        "..oWkssmmssk o..".replace(' ', 'W'),
        "...oSsssssSSo...",
        "....oo8888oo....",
        "...o88888888o...",
        "..o8788888878o..",
        "..os88888888so..",
        "..os8+++8888so..",
        "...o8+=+8888o...",
        "...o88++8888o...",
        "....o88o88o.....",
        "....o88oo88o....",
        "....offo.offo...",
        "....oooo.oooo...",
    ],
}
GRANNY['idle0'][9] = "..oWseesseesWo.."
GRANNY['idle0'][11] = "..oWkssmmsskWo.."
GRANNY['idle0'][20] = "....o88oo88o...."
GRANNY['idle0'][22] = "....offo.offo..."


def villager_frames():
    out = {}
    g0 = parse([r[:16].ljust(16, '.') for r in GRANNY['idle0']])
    g1 = blank(16, 24)
    paste(g1, g0.crop((0, 0, 16, 20)), 0, -1)
    paste(g1, g0.crop((0, 19, 16, 24)), 0, 19)
    out['granny0'] = g0
    out['granny1'] = g1
    # cat (12x10), two frames sitting + two walking (side)
    cat_sit0 = parse([
        "............",
        "..o.....o...",
        ".o+o...o+o..",
        ".o+=ooo=+o..",
        ".o+++++++o..",
        ".o+e+++e+o..",
        ".ow++kk++wo.",
        "..owwwwwwo.o",
        "..o+wwww+o+o",
        "..oowoowoo+o",
    ])
    cat_sit1 = parse([
        "............",
        "............",
        "..o.....o...",
        ".o+o...o+o..",
        ".o+=ooo=+o..",
        ".o+++++++o..",
        ".o+e+++e+o.o",
        ".ow++kk++wo+",
        "..o+wwww+o+o",
        "..oowoowooo.",
    ])
    cat_walk0 = parse([
        "............",
        "........o.o.",
        ".......o+o+o",
        "o.....o+++e+",
        "+oooooo++++o",
        "o+=+=+++++wo",
        ".o+++++++oo.",
        ".o+wo..o+o..",
        ".owo...owo..",
        ".oo....oo...",
    ])
    cat_walk1 = parse([
        "............",
        "........o.o.",
        ".......o+o+o",
        ".o....o+++e+",
        "o+ooooo++++o",
        ".o+=+=++++wo",
        ".o+++++++oo.",
        "..o+wo+wo...",
        "..owo.owo...",
        "..oo..oo....",
    ])
    out['cat_sit0'] = cat_sit0
    out['cat_sit1'] = cat_sit1
    out['cat_walk0'] = cat_walk0
    out['cat_walk1'] = cat_walk1
    # fisherman (mud-sled uncle): yellow rain hat and coat
    fisher = [
        "................",
        "................",
        "................",
        ".....oooooo.....",
        "....onnnnnno....",
        "...onnnnnnnno...",
        ".oonnnnnnnnnnoo.",
        "onnnnnnnnnnnnnno",
        ".occcccccccccco.",
        "..oHsssssssssHo.",
        "..oHsessssesHo..",
        "..oHsessssesHo..",
        "..oHHHHmmHHHHo..",
        "...oHHHHHHHHo...",
        "...onnnnnnnno...",
        "..onnnnnnnnnno..",
        "..osnnnccnnnso..",
        "..onnnnBcnnnno..",
        "...onnnnnnnno...",
        "...oBBBooBBBo...",
        "....oBBooBBo....",
        "....oBBooBBo....",
        "....offo.offo...",
        "....oooo.oooo...",
    ]
    fisher[9] = "..oHsssssssssHo."[:16]
    fisher[9] = "..oHssssssssHo.."
    f0 = parse([r[:16].ljust(16, '.') for r in fisher])
    out['fisher0'] = f0
    f1 = blank(16, 24)
    paste(f1, f0.crop((0, 0, 16, 19)), 0, -1)
    paste(f1, f0.crop((0, 18, 16, 24)), 0, 18)
    out['fisher1'] = f1
    # lighthouse keeper: navy coat, white beard, cap
    keeper = [
        "................",
        "................",
        "................",
        "................",
        ".....oooooo.....",
        "....o&&&&&&o....",
        "...o%%%%%%%%o...",
        "...o&&nn&&&&o...",
        "..oo88888888oo..",
        "..oHssssssssHo..",
        "..oHsessssesHo..",
        "..oHsessssesHo..",
        "..owwwssssswwo..",
        "..owwwwmmwwwwo..",
        "...owwwwwwwwo...",
        "..o%%%wwww%%%o..",
        "..o%%%%nn%%%%o..",
        "..os%%%%%%%%so..",
        "...o%%%nn%%%o...",
        "...o&&&&&&&&o...",
        "....o&&oo&&o....",
        "....o88oo88o....",
        "....offo.offo...",
        "....oooo.oooo...",
    ]
    k0 = parse([r[:16].ljust(16, '.') for r in keeper])
    out['keeper0'] = k0
    k1 = blank(16, 24)
    paste(k1, k0.crop((0, 0, 16, 19)), 0, -1)
    paste(k1, k0.crop((0, 18, 16, 24)), 0, 18)
    out['keeper1'] = k1
    # boatman: conical straw hat, striped shirt
    boat = [
        "................",
        "................",
        "................",
        ".......oo.......",
        "......oaAo......",
        ".....oaaaAo.....",
        "....oaaaaaAo....",
        "..ooaaaaaaaAoo..",
        ".occcccccccccco.",
        "..oHssssssssHo..",
        "..oHsessssesHo..",
        "..oHsessssesHo..",
        "..oskssmmsskso..",
        "...osssssssso...",
        "...owwwwwwwwo...",
        "..o$$$$$$$$$$o..",
        "..owwwwwwwwwwo..",
        "..os$$$$$$$$so..",
        "...owwwwwwwwo...",
        "...o33333333o...",
        "....o33oo33o....",
        "....osso.osso...",
        "....osso.osso...",
        "....oooo.oooo...",
    ]
    b0 = parse([r[:16].ljust(16, '.') for r in boat])
    out['boatman0'] = b0
    b1 = blank(16, 24)
    paste(b1, b0.crop((0, 0, 16, 19)), 0, -1)
    paste(b1, b0.crop((0, 18, 16, 24)), 0, 18)
    out['boatman1'] = b1
    return out
