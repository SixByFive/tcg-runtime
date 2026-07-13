// Seed abbreviation into m_sets from the known TCGdex code → abbreviation map.
// Safe to run on every startup: only updates rows where abbreviation is currently blank.

import { Set } from '../models/index.js';

// Maps tcgdex code → our internal abbreviation.
export const ALIASES = Object.freeze({
  // Mega Evolution
  'me01': 'MEG',  'me02': 'PFL',   'me2.5': 'ASC',  'me03': 'POR',
  'me04': 'CRI',
  // Scarlet and Violet
  'svp':  'SVP',  'sv01': 'SVI',   'sv02':  'PAL',   'sv03':  'OBF',
  'sv03.5': 'MEW','sv04': 'PAR',   'sv04.5':'PAF',   'sv05':  'TEF',
  'sv06': 'TWM',  'sv6.5':'SFA',   'sv07':  'SCR',   'sv08':  'SSP',
  'sv08.5':'PRE', 'sv09':'JTG',    'sv10':  'DRI',   'sv10.5b':'BLK',
  'sv10.5w':'WHT',
  // Sword and Shield
  'swshp':'SWSH', 'swsh1':'SSH',   'swsh2': 'RCL',   'swsh3': 'DAA',
  'swsh3.5':'CPA','swsh4':'VIV',   'swsh4.5':'SHF',  'swsh5': 'BST',
  'swsh6':'CRE',  'swsh7':'EVS',   'swsh8': 'FST',   'swsh9': 'BRS',
  'swsh10':'ASR', 'swsh10.5':'PGO','swsh11':'LOR',   'swsh12':'SIT',
  'swsh12.5':'CRZ','cel25':'CEL',  'fut2020':'FUT',
  // Sun and Moon
  'smp':  'SMP',  'sm1':  'SUM',   'sm2':   'GRI',   'sm3':   'BUS',
  'sm3.5':'SLG',  'sm4':  'CIN',   'sm5':   'UPR',   'sm6':   'FLI',
  'sm7':  'CES',  'sm7.5':'DRM',   'sm8':   'LOT',   'sm9':   'TEU',
  'sm10': 'UNB',  'sm11': 'UNM',   'sm12':  'CEC',   'det1':  'DET',
  'sm115':'HIF',  'sma':  'SMA',

  'xyp':  'XYP',  'xy0':  'KSS',   'xy1':   'XY',    'xy2':   'FLF',
  'xy3':  'FFI',  'xy4':  'PHF',   'xy5':   'PRC',   'dc1':   'DCR',
  'xy6':  'ROS',  'xy7':  'AOR',   'xy8':   'BKT',   'xy9':   'BKP',
  'g1':   'GEN',  'xy10': 'FCO',   'xy11':  'STS',   'xy12':  'EVO',
  'bwp':  'BWP',  'bw1':  'BLW',   'bw2':   'EPO',   'bw3':   'NVI',
  'bw4':  'NXD',  'bw5':  'DEX',   'bw6':   'DRX',   'dv1':   'DRV',
  'bw7':  'BCR',  'bw8':  'PLS',   'bw9':   'PLF',   'bw10':  'PLB',
  'bw11': 'LTR',  'rc':   'RC',

  'dpp':  'DPP',  'dp1':  'DP',    'dp2':   'MT',    'dp3':   'SW',
  'dp4':  'GE',   'dp5':  'MD',    'dp6':   'LA',    'dp7':   'SF',
  'pl1':  'PL',   'pl2':  'RR',    'pl3':   'SV',    'pl4':   'AR',
  'hgssp':'HSP',  'hgss1':'HS',    'hgss2': 'UL',    'hgss3': 'UD',
  'hgss4':'TM',   'col1': 'CL',
  
  'ex1':  'RS',   'ex2':  'SS',    'ex3':   'DR',    'ex4':   'MA',
  'ex5':  'HL',   'ex6':  'RG',    'ex7':   'TRR',   'ex8':   'DX',
  'ex9':  'EM',   'ex10': 'UF',    'ex11':  'DS',    'ex12':  'LM',
  'ex13': 'HP',   'ex14': 'CG',    'ex15':  'DF',    'ex16':  'PK',
  'ecard1':'EX',  'ecard2':'AQ',   'ecard3':'SK',    'lc':    'LC',
  'neo1': 'N1',   'neo2': 'N2',    'neo3':  'N3',    'neo4':  'N4',
  'base1':'BS',   'base2':'JU',    'base3': 'FO',    'base4': 'B2',
  'base5':'TR',   'gym1': 'G1',    'gym2':  'G2',    'si1':   'SI',
  'ex5.5':'CC',   'np':   'NP',    'basep': 'WP',
  'pop1': 'POP1', 'pop2': 'POP2',  'pop3':  'POP3',  'pop4':  'POP4',
  'pop5': 'POP5', 'pop6': 'POP6',  'pop7':  'POP7',  'pop8':  'POP8',
  'pop9': 'POP9',
});

/**
 * Seed abbreviation into m_sets.
 * For each entry, find the set row by tcgdex code and set abbreviation if blank.
 * Creates a minimal placeholder row if the set hasn't been ingested yet.
 */
export async function seedSetAliases(logger = console) {
  let updated = 0;
  let skipped = 0;

  for (const [tcgdexCode, abbr] of Object.entries(ALIASES)) {
    const [row, created] = await Set.findOrCreate({
      where: { code: tcgdexCode },
      defaults: { code: tcgdexCode, abbreviation: abbr, name: abbr },
    });

    if (created) {
      updated++;
      continue;
    }

    if (!row.abbreviation) {
      row.abbreviation = abbr;
      await row.save();
      updated++;
    } else {
      skipped++;
    }
  }

  logger.info?.(`[setAliases] seed done — updated=${updated} skipped=${skipped}`);
  return { updated, skipped };
}
