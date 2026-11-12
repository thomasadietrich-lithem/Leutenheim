// Fichier généré par art/marchand_v1.py export (planche art/marchand_v1.png). Ne pas modifier à la main.

export const MARCHAND_PALETTE: Record<string, string> = {"K": "#18121e", "H": "#4a3a5a", "h": "#6a5880", "C": "#5a6a3a", "F": "#1e1622", "Y": "#f4e04a", "N": "#c89a7a", "n": "#946a52", "T": "#e8debe", "P": "#8a6038", "p": "#5a3e22", "R": "#c4a060", "S": "#9aa2b4", "s": "#5e6476", "L": "#ffd75e", "l": "#b07a1a", "G": "#e8b83a", "B": "#3a2a1e", "W": "#8a6a44", "#": "#fff3c8"};

/** Le Colporteur : face, profil (vers la droite), dos (16 × 20), et sa bulle (12 × 10). */
export const MARCHAND: Record<"front" | "side" | "back" | "bubble", string[]> = {
  front: ["....KKK...KKK...", "...KSSsK.KLlK...", "..KSSSSsKKLLK...", "..KpPPPPPPPPpK..", "..KPPKKKKKKPPK..", "..KPKhhhhhhKPK..", "..KPKhHHHHhKPK..", "..KKhHFFFFHhKK..", "...KhFYFFYFhK...", "...KhFFNNFFhK...", "...KHhFTTFhHK...", "..KHHHhhhhHHHK..", ".KHHCHHRHHHHHHK.", ".KhHHHHHRHHCHhK.", ".KNKHHHHHRHHKNK.", "..KKHHHHHHHHKK..", "...KHHhHHhHHK...", "...KHHhHHhHHK...", "...KBBK..KBBK...", "...KKKK..KKKK..."],
  side: ["..KKK...........", ".KSSsK.KKK......", ".KSSSsKLlK......", "KpPPPPKLLK......", "KPPPPPPKKKK.....", "KPPPPPKhhhhK....", "KPPPPKhHHHhhK...", "KPPPPKHHFFFhK...", "KpPPPKHHFYFNK...", "KPPPPKHHFFNNNK..", ".KPPPKHHFTFK.K..", ".KpPKHHHhhhK.KW.", "..KKHHRHHHHHKNKW", "...KHHHRHHHHKK.W", "...KHHHHRHHHK..W", "...KHCHHHHHHK..W", "...KHHhHHHhK...W", "...KHHhHHHhK...W", "...KBBK.KBBK...W", "...KKKK.KKKK...K"],
  back: ["....KKK...KKK...", "...KSSsK.KLlK...", "..KSSSSsKKLLK...", "..KpPPPPPPPPpK..", ".KPPPPPPPPPPPPK.", ".KPPRPPPPPPRPPK.", ".KPPRPPGPPPRPPK.", ".KpPRPPPPPPRPpK.", ".KPPRPPPPPPRPPK.", ".KPPRPPPPPPRPPK.", ".KpPPPPPPPPPPpK.", "..KPPPPPPPPPPK..", ".KHHKKKKKKKKHHK.", ".KhHHHHHHHHHHhK.", ".KnKHHHHHHHHKnK.", "..KKHHHHHHHHKK..", "...KHHhHHhHHK...", "...KHHhHHhHHK...", "...KBBK..KBBK...", "...KKKK..KKKK..."],
  bubble: [".KKKKKKKKKK.", "K##########K", "K####GG####K", "K###GGGG###K", "K###GlGG###K", "K####GG####K", "K##########K", ".KKKK##KKKK.", ".....K#K....", "......K....."],
};
