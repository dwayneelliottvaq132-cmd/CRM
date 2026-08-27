// Ported verbatim from Claude Design 'TPP Finishing Control.dc.html'.
// Fixture data — no backend calls. Do not hand-edit; re-extract from the design.

export const OCHRE = '#9A6B00', RED = '#B3261E', GREEN = '#1E6B4E', BLUE = '#2B4C8C';

export const chip = (c: string, bg: string, bd: string) => `font-family:'Space Mono',monospace; font-size:9px; letter-spacing:0.06em; padding:2px 7px; border-radius:3px; color:${c}; background:${bg}; border:1px solid ${bd}; white-space:nowrap`;
export const S = {
  open:   chip(RED, '#FFF1F0', '#F0CFCB'),
  review: chip(OCHRE, '#FAF6EC', '#EADFC4'),
  ready:  chip(GREEN, '#EFF7F3', '#C9E3D8'),
  info:   chip(BLUE, '#EFF3FB', '#CBD8EF'),
  grey:   chip('#6B6B72', '#F4F4F5', '#E1E1E4')
};
export const SEV = { HIGH: chip(RED, '#FFF1F0', '#F0CFCB'), MED: chip(OCHRE, '#FAF6EC', '#EADFC4'), LOW: chip('#6B6B72', '#F4F4F5', '#E1E1E4') };
export const FLWRAP = {
  HIGH: 'padding:10px 12px; border-radius:4px; background:#FFF8F7; border:1px solid #F5DEDB',
  MED:  'padding:10px 12px; border-radius:4px; background:#FDFBF5; border:1px solid #EDE5D2',
  LOW:  'padding:10px 12px; border-radius:4px; background:#FAFAFB; border:1px solid #EFEFF1'
};
export const VAL = "font-family:'Space Mono',monospace; font-size:11.5px; line-height:1.45";
export const VAL_MISS = "font-family:'Space Mono',monospace; font-size:11.5px; line-height:1.45; color:#B3261E";

// NOTE: PO 243882 ln 2 AREA / PART reads f(k, v, true) in the source design —
// the "missing" flag landed in the `sub` slot, which would render the word "true"
// as the caption and leave the value un-flagged. Corrected to f(k, v, '', true)
// above; fix it in the design too so the two do not diverge.
export function f(k: string, v: string, sub?: string, miss?: boolean) {
  return { k, v, sub: sub || '', style: miss ? VAL_MISS : VAL };
}

export const DOCS = [
  {
    no: '243875', customer: 'Amphenol Fiber Systems Intl.', date: '08/05/26',
    status: 'blocked', statusKey: 'open',
    summary: '1 line · 104 ea backshell, hard anodize. PO cites a different dash number than the part ordered.',
    parse: 'raster scan · OCR', flagN: 4, flagSev: 'HIGH',
    po: 'docs/PO-243875.pdf', dwg: 'docs/DWG-111-349_A.pdf', dwgLabel: '111-349 rev A',
    header: [
      { k: 'CUSTOMER', v: 'Amphenol Fiber Systems Intl.' },
      { k: 'SHIP TO', v: '859 State Hwy 121 Bldg 2, Allen TX' },
      { k: 'PO DATE', v: '08/05/26' },
      { k: 'TERMS', v: 'NET 30 · FOB destination' },
      { k: 'BUYER', v: 'Maciel Lopez / Doug Gordon' },
      { k: 'PO-WIDE', v: 'C of C and packing list on every shipment. AFSI supplier quality clause guide Form 4-4.4-87 rev H, effective 07/27/26.' }
    ],
    lines: [{
      no: 1, part: '111-349-2', desc: 'Backshell, 90°', qty: '104', unit: '$3.7500',
      fields: [
        f('MATERIAL', 'not determinable', 'drawing note 5 defers material to AFSI FSP-1066', true),
        f('PROCESS', 'Hard anodize'),
        f('SPEC', 'MIL-A-8625', 'PO prints "TYPE 111" — read as Type III'),
        f('TYPE / CLASS', 'Type III, Class 2, black'),
        f('THICKNESS', '.0018–.0024 in', '.0009–.0012 build-up per surface'),
        f('MASKING', 'none called out'),
        f('POST-TREAT', 'none called out'),
        f('AREA / PART', 'not on print', 'no plating-area note on 111-349', true),
        f('C OF C', 'required', 'PO-wide clause'),
        f('FAI', 'not stated', 'PO field N', true)
      ],
      flags: [
        { sev: 'HIGH', title: 'PO part and referenced drawing are different dash numbers', detail: 'The order is for 111-349-2. The drawing reference block on the same line reads 111-349-1 rev A. On this print family the dash number is what selects the finish, so the two cannot both be right.', source: 'PO 243875 ln 1 · drawing ref block' },
        { sev: 'HIGH', title: 'Finish selection deferred to FSP-1066, which is not on file', detail: 'Note 5 sends material and finishing to AFSI document FSP-1066. The print itself carries three alternative finishes — hard anodize MIL-A-8625, passivate ASTM A-967, and dry film lube FSP-1034 — with no dash-to-finish mapping on the sheet.', source: '111-349 rev A · note 5, finish notes 1–3' },
        { sev: 'MED', title: 'Dimensional waiver quoted on the PO', detail: 'The line carries "DIMENSION WAIVED FOR: Ø.330 max", signed Bryan Cull 5/19/2020, against a print revised 06/02/2020. Confirm the waiver still applies at rev A before planning.', source: 'PO 243875 ln 1 · note block' },
        { sev: 'LOW', title: 'Surface area not stated on the print', detail: 'Sister prints in this family state a plating surface area note; 111-349 does not. Area must be estimated from the envelope or supplied by the customer.', source: '111-349 rev A · notes 1–4' }
      ],
      priceState: "can't price yet", priceKey: 'open', priceNote: '3 quoting inputs open',
      openList: 'OPEN: governing dash number · base material (FSP-1066) · surface area'
    }]
  },
  {
    no: '243877', customer: 'Amphenol Fiber Systems Intl.', date: '08/05/26',
    status: 'blocked', statusKey: 'open',
    summary: '3 lines · 850 ea black hard anodize. One line carries no drawing number at all.',
    parse: 'text layer', flagN: 6, flagSev: 'HIGH',
    po: 'docs/PO-243877.pdf', dwg: 'docs/DWG-217-102_E.pdf', dwgLabel: '217-102 rev E',
    header: [
      { k: 'CUSTOMER', v: 'Amphenol Fiber Systems Intl.' },
      { k: 'SHIP TO', v: '859 State Hwy 121 Bldg 2, Allen TX' },
      { k: 'PO DATE', v: '08/05/26' },
      { k: 'TERMS', v: 'NET 30 · FOB destination' },
      { k: 'ORDER DESC', v: 'Plating' },
      { k: 'PO-WIDE', v: 'C of C and packing list on every shipment. Ship UPS #67730W. No shipments more than 2 weeks early.' }
    ],
    lines: [
      {
        no: 1, part: '217-102-BL0', desc: 'Nut, insert retaining, SH13, M28', qty: '500', unit: '$1.8000',
        fields: [
          f('MATERIAL', 'not determinable', 'note 5 defers material to FSP-1066', true),
          f('PROCESS', 'Hard anodize, black'),
          f('SPEC', 'MIL-PRF-8625', 'as written on the PO — see check below', true),
          f('TYPE / CLASS', 'Type III, Class 2'),
          f('THICKNESS', '.0018–.0024 in', '.0009–.0012 build-up'),
          f('DRAWING', '217-102-A40 rev E', 'rev E on file — match'),
          f('MASKING', 'none called out'),
          f('AREA / PART', '≈3.4 est.', 'Ø.892 × .580 envelope + .875-20 UNEF thread'),
          f('C OF C', 'required'),
          f('FAI', 'yes', 'PO field Y')
        ],
        flags: [
          { sev: 'HIGH', title: 'Anodize spec written as MIL-PRF-8625', detail: 'There is no MIL-PRF-8625. Anodic coatings for aluminium are MIL-A-8625F. The Type III Class 2 and thickness callouts are consistent with MIL-A-8625, but the spec designation on the order has to be corrected before it can be planned or certified against.', source: 'PO 243877 ln 1 · finish text' },
          { sev: 'MED', title: 'Finish text on the line is duplicated and self-conflicting', detail: 'The Type / Class / colour / thickness string appears twice on the same line with different fragments in each pass. Both passes give Type III black .0018–.0024, but only one names Class 2.', source: 'PO 243877 ln 1' },
          { sev: 'MED', title: 'Lot of 500 sits above the minimum-lot band', detail: 'This is a volume line. No published volume rate exists for hard anodize on the card, so the price band is a decision, not a lookup.', source: 'quantity 500 ea' },
          { sev: 'LOW', title: 'Area estimated, not stated', detail: 'No plating-area note on 217-102. Estimate taken from the Ø.892 body, .580 length and the .875-20 UNEF-2B thread. Treat as low confidence.', source: '217-102 rev E · dimensions' }
        ],
        priceState: "can't price yet", priceKey: 'open', priceNote: '2 quoting inputs open',
        openList: 'OPEN: governing anodize spec · volume price band above minimum lot'
      },
      {
        no: 2, part: '217-104-4BL0', desc: 'WMR body, SH13, K4, black hard anodize, PTFE', qty: '30', unit: '$2.7000',
        fields: [
          f('MATERIAL', 'not determinable', 'note 8 defers material to FSP-1066', true),
          f('PROCESS', 'Hard anodize, black, PTFE'),
          f('SPEC', 'MIL-PRF-8625', 'same misdesignation as line 1', true),
          f('TYPE / CLASS', 'Type III, Class 2'),
          f('THICKNESS', '.0018–.0024 in', '.0009–.0012 build-up'),
          f('DRAWING', 'blank on PO', 'drawing no., rev and date fields all empty', true),
          f('MASKING', 'none called out'),
          f('AREA / PART', 'not on print', '217-104 states no area note', true),
          f('C OF C', 'required'),
          f('FAI', 'yes')
        ],
        flags: [
          { sev: 'HIGH', title: 'PO carries no drawing number or revision for this line', detail: 'The drawing number and revision level fields are blank and the internal date reads 00/00/0000. The library copy is 217-104 rev H dated 06/12/2024. Nothing on the order ties the part to that revision.', source: 'PO 243877 ln 2 · drawing ref block' },
          { sev: 'HIGH', title: 'PTFE impregnation is a separate operation', detail: 'The description calls PTFE. MIL-A-8625 Type III Class 2 with a PTFE-impregnated seal is a distinct step with its own tank and its own adder; it is not covered by the anodize line.', source: 'PO 243877 ln 2 · description' },
          { sev: 'MED', title: 'Source-controlled part — DLA approval required', detail: 'Note 11 on 217-104 states the part is source controlled and DLA must approve all sources of supply prior to use. Confirm TPP is a listed approved source at rev H before accepting.', source: '217-104 rev H · note 11' }
        ],
        priceState: "can't price yet", priceKey: 'open', priceNote: '3 quoting inputs open',
        openList: 'OPEN: drawing revision · PTFE seal adder (no published rate) · surface area'
      },
      {
        no: 3, part: '217-117-BL0', desc: '45° backshell / press sleeve assy, SH13', qty: '320', unit: '$4.0500',
        fields: [
          f('MATERIAL', 'not determinable', 'note 5 defers material to FSP-1066', true),
          f('PROCESS', 'Hard anodize, black'),
          f('SPEC', 'MIL-A-8625'),
          f('TYPE / CLASS', 'Type III, Class 2'),
          f('THICKNESS', '.0018–.0024 in', '.0009–.0012 build-up'),
          f('DRAWING', '217-117 rev C', 'rev C on file — match'),
          f('CONFIGURATION', '2-piece assembly', '217-116 body + 217-130 press sleeve'),
          f('AREA / PART', 'not on print', 'assembly drawing, no area note', true),
          f('C OF C', 'required'),
          f('FAI', 'yes')
        ],
        flags: [
          { sev: 'HIGH', title: 'Assemble before plate', detail: 'Note 1 requires unplated components to be assembled prior to plating. The press sleeve must be installed with tool FSTF0114 and the housing held in support tool FSTF0823. This is an in-process operation ahead of the tank, not a straight-through dip.', source: '217-117 rev C · notes 1, 3, 4' },
          { sev: 'HIGH', title: 'Lot quantities do not sum to the order quantity', detail: 'The line carries two lot numbers with sub-quantities — 2-90 and 1-20 on the first, 1-108 and 1-12 on the second — totalling 230 pieces against an order of 320. Ninety pieces are unassigned.', source: 'PO 243877 ln 3 · lot block' },
          { sev: 'LOW', title: 'Area not stated on the assembly print', detail: 'Wetted area covers the assembled part, including the press sleeve outer surface. Estimate from the two component prints or request the figure.', source: '217-117 rev C' }
        ],
        priceState: "can't price yet", priceKey: 'open', priceNote: '3 quoting inputs open',
        openList: 'OPEN: lot quantity reconciliation · pre-plate assembly labour · surface area'
      }
    ]
  },
  {
    no: '243879', customer: 'Amphenol Fiber Systems Intl.', date: '08/05/26',
    status: 'blocked', statusKey: 'open',
    summary: '2 lines · cadmium over electroless nickel. Neither drawing is in the library.',
    parse: 'text layer', flagN: 5, flagSev: 'HIGH',
    po: 'docs/PO-243879.pdf', dwg: 'docs/DWG-217-311_D.pdf', dwgLabel: 'no matching print — showing 217-311 rev D',
    header: [
      { k: 'CUSTOMER', v: 'Amphenol Fiber Systems Intl.' },
      { k: 'PO DATE', v: '08/05/26' },
      { k: 'TERMS', v: 'NET 30 · FOB destination' },
      { k: 'ORDER DESC', v: 'Plating' },
      { k: 'PO-WIDE', v: 'C of C and packing list on every shipment. AFSI clause guide rev H.' }
    ],
    lines: [
      {
        no: 1, part: '217-113-AH0', desc: '90° backshell body, SH13, cad OD', qty: '9', unit: '$10.8620',
        fields: [
          f('MATERIAL', 'not determinable', 'no print on file; FSP-1066 not supplied', true),
          f('PROCESS', 'Cadmium over electroless nickel'),
          f('SPEC', 'SAE-QQ-P-416 / ASTM B733'),
          f('TYPE / CLASS', 'Cd Type II olive drab · EN Type IV Class 1'),
          f('THICKNESS', 'Cd .0005–.0007 over EN .0004–.0005', 'total .0009–.0012'),
          f('DRAWING', '217-113-A40 rev G', 'not in library', true),
          f('POST-TREAT', 'undetermined', 'embrittlement relief depends on base material', true),
          f('AREA / PART', 'not available', 'no print', true),
          f('C OF C', 'required'),
          f('FAI', 'not required', 'PO field N')
        ],
        flags: [
          { sev: 'HIGH', title: 'Drawing 217-113-A40 rev G is not in the library', detail: 'Nothing on file to check the order against — no material, no dimensions, no masking, no area. The print has to be requested before this line moves.', source: 'PO 243879 ln 1 · drawing ref' },
          { sev: 'HIGH', title: 'Embrittlement relief bake undetermined', detail: 'QQ-P-416 requires embrittlement relief for steel parts above the strength threshold, and the bake duration band changes the price materially. Base material is unknown, so whether a bake is required at all is unknown.', source: 'SAE-QQ-P-416 · material unknown' },
          { sev: 'MED', title: 'Duplex stack — two processes, one wetted area', detail: 'Cadmium with olive drab chromate over electroless nickel. Both wet the whole part, so both price against the same area and both need their own thickness verification.', source: 'PO 243879 ln 1 · finish text' }
        ],
        priceState: "can't price yet", priceKey: 'open', priceNote: '3 quoting inputs open',
        openList: 'OPEN: drawing · base material and bake requirement · surface area'
      },
      {
        no: 2, part: 'FS3M-193-14', desc: 'Plug body, front ratchet, SH15, K1, cad OD', qty: '20', unit: '$10.8630',
        fields: [
          f('MATERIAL', 'not determinable', 'no print on file', true),
          f('PROCESS', 'Cadmium over electroless nickel'),
          f('SPEC', 'not stated on line', 'no QQ-P-416 or B733 reference on this line', true),
          f('TYPE / CLASS', 'not stated', 'colour olive drab only', true),
          f('THICKNESS', '.0004–.0007 in', 'stated as a total for the stack'),
          f('DRAWING', 'FS3M-193-1 rev G', 'not in library', true),
          f('AREA / PART', 'not available', 'no print', true),
          f('C OF C', 'required'),
          f('FAI', 'not required')
        ],
        flags: [
          { sev: 'HIGH', title: 'No governing spec on the line', detail: 'The line names cad over electroless nickel and a colour but cites no specification. Line 1 of the same order gives QQ-P-416 and ASTM B733 for the identical finish. Which spec governs here is a question for the customer, not an assumption.', source: 'PO 243879 ln 2 · finish text' },
          { sev: 'HIGH', title: 'Total thickness conflicts with line 1', detail: 'This line calls .0004–.0007 total for cad over EN. Line 1 calls .0009–.0012 total for the same stack. One of the two is wrong or the two parts have genuinely different requirements — confirm before planning either.', source: 'PO 243879 ln 1 vs ln 2' },
          { sev: 'MED', title: 'Drawing FS3M-193-1 rev G not in the library', detail: 'Print required before the line can be planned.', source: 'PO 243879 ln 2 · drawing ref' }
        ],
        priceState: "can't price yet", priceKey: 'open', priceNote: '4 quoting inputs open',
        openList: 'OPEN: governing spec · thickness conflict · drawing · surface area'
      }
    ]
  },
  {
    no: '243880', customer: 'Amphenol Fiber Systems Intl.', date: '08/05/26',
    status: 'ready', statusKey: 'ready',
    summary: '1 line · 10 ea 316 stainless passivate. Cleanest order in the queue.',
    parse: 'text layer', flagN: 2, flagSev: 'LOW',
    po: 'docs/PO-243880.pdf', dwg: 'docs/DWG-217-324_J.pdf', dwgLabel: 'no matching print — showing 217-324 rev J',
    header: [
      { k: 'CUSTOMER', v: 'Amphenol Fiber Systems Intl.' },
      { k: 'PO DATE', v: '08/05/26' },
      { k: 'TERMS', v: 'NET 30 · FOB destination' },
      { k: 'DUE', v: '08/21/26' },
      { k: 'PO-WIDE', v: 'C of C and packing list on every shipment.' }
    ],
    lines: [{
      no: 1, part: 'FS5M-911-2', desc: 'Backshell body, straight, SHL13', qty: '10', unit: '$8.5000',
      fields: [
        f('MATERIAL', '316 stainless', 'stated on the PO line'),
        f('PROCESS', 'Passivate'),
        f('SPEC', 'ASTM A-967'),
        f('TYPE / CLASS', 'not stated', 'A967 nitric / citric method not specified'),
        f('THICKNESS', 'n/a', 'conversion — no thickness'),
        f('DRAWING', 'FS5M-911-1 rev C', 'not in library', true),
        f('MASKING', 'none called out'),
        f('POST-TREAT', 'none required'),
        f('AREA / PART', 'not required', 'passivate prices on lot minimum'),
        f('C OF C', 'required')
      ],
      flags: [
        { sev: 'MED', title: 'Drawing FS5M-911-1 rev C not in the library', detail: 'Material and process are fully stated on the PO line, so the print is not blocking the price. It is still needed before planning and inspection.', source: 'PO 243880 ln 1 · drawing ref' },
        { sev: 'LOW', title: 'RoHS clause on the line', detail: 'The line calls RoHS compliant. Passivate on 316 introduces no restricted substance, so this affects certificate language only — but it must appear on the C of C.', source: 'PO 243880 ln 1 · finish text' }
      ],
      priceState: 'ready to price', priceKey: 'ready', priceNote: 'lot of 10 — minimum charge governs; no area needed',
      openList: 'No open inputs. Load the TPP rate card to compute the draft figure.'
    }]
  },
  {
    no: '243882', customer: 'Amphenol Fiber Systems Intl.', date: '08/05/26',
    status: 'blocked', statusKey: 'open',
    summary: '2 lines · electroless nickel. One thickness falls below any published ASTM B733 grade.',
    parse: 'text layer', flagN: 5, flagSev: 'HIGH',
    po: 'docs/PO-243882.pdf', dwg: 'docs/DWG-217-104_H.pdf', dwgLabel: '217-104 rev H',
    header: [
      { k: 'CUSTOMER', v: 'Amphenol Fiber Systems Intl.' },
      { k: 'PO DATE', v: '08/05/26' },
      { k: 'TERMS', v: 'NET 30 · FOB destination' },
      { k: 'ORDER DESC', v: 'Plating' },
      { k: 'PO-WIDE', v: 'C of C and packing list on every shipment.' }
    ],
    lines: [
      {
        no: 1, part: '217-101-1AU0', desc: 'Junior body, SH13, K1, electroless Ni, M28', qty: '10', unit: '$4.0000',
        fields: [
          f('MATERIAL', 'not determinable', 'note defers material to FSP-1066', true),
          f('PROCESS', 'Electroless nickel'),
          f('SPEC', 'ASTM B733'),
          f('TYPE / CLASS', 'Type IV, Class 1', 'Type IV = zincate pretreat, i.e. aluminium base'),
          f('THICKNESS', '.0009–.0012 in total'),
          f('DRAWING', '217-101-1A40 rev K', 'not in library', true),
          f('MASKING', 'none called out'),
          f('AREA / PART', 'not available', 'no print', true),
          f('C OF C', 'required'),
          f('FAI', 'not required')
        ],
        flags: [
          { sev: 'MED', title: 'Drawing 217-101-1A40 rev K not in the library', detail: 'Print required to confirm material, masking and area.', source: 'PO 243882 ln 1 · drawing ref' },
          { sev: 'LOW', title: 'Type IV implies an aluminium base', detail: 'ASTM B733 Type IV is the zincate-pretreated class, which is consistent with an aluminium part. That is an inference from the spec, not a statement on the order — confirm against FSP-1066.', source: 'ASTM B733 · PO finish text' }
        ],
        priceState: "can't price yet", priceKey: 'open', priceNote: '2 quoting inputs open',
        openList: 'OPEN: base material confirmation · surface area'
      },
      {
        no: 2, part: '217-104-1HF0', desc: 'WMR body, SH13, K1, Ni on 316 stainless, M28', qty: '20', unit: '$4.0000',
        fields: [
          f('MATERIAL', '316 stainless', 'per line description'),
          f('PROCESS', 'Electroless nickel'),
          f('SPEC', 'ASTM B733'),
          f('TYPE / CLASS', 'Type IV, Class 1', 'Type IV is the aluminium class — see check', true),
          f('THICKNESS', '.0001–.0002 in total', 'below any published B733 grade', true),
          f('DRAWING', '217-104-1H10 rev H', 'rev H on file — match'),
          f('PRE-TREAT', 'not called out', 'Wood’s nickel strike expected on stainless', true),
          f('AREA / PART', 'not on print', '', true),
          f('C OF C', 'required'),
          f('FAI', 'yes')
        ],
        flags: [
          { sev: 'HIGH', title: 'Thickness .0001–.0002 in is below every ASTM B733 grade', detail: 'The thinnest grade published in B733 is .0002 in. A range that starts at .0001 cannot be certified to the spec as written. Either a grade is intended that the order does not name, or the thickness is wrong.', source: 'PO 243882 ln 2 · vs ASTM B733 grade table' },
          { sev: 'HIGH', title: 'Type IV called on a stainless part', detail: 'The line describes a 316 stainless base but specifies B733 Type IV, which is the zincate pretreatment used on aluminium. Stainless takes Type II. The type designation and the stated base material contradict each other.', source: 'PO 243882 ln 2 · description vs spec' },
          { sev: 'HIGH', title: 'Same base part ordered at a different thickness on PO 243877', detail: '217-104 appears on PO 243877 line 2 as a black hard anodize with .0009–.0012 build-up, and here as electroless nickel at .0001–.0002. Different dash numbers, but confirm the finish codes before either lot is planned.', source: 'cross-order match: 217-104-4BL0 / 217-104-1HF0' },
          { sev: 'MED', title: 'No pre-treatment called out for EN on stainless', detail: 'Electroless nickel on 300-series stainless normally requires a Wood’s nickel strike for adhesion. Nothing on the order addresses it, and it is an unpriced adder.', source: 'PO 243882 ln 2' }
        ],
        priceState: "can't price yet", priceKey: 'open', priceNote: '3 quoting inputs open',
        openList: 'OPEN: thickness / grade conflict · Type II vs Type IV · strike pre-treatment (unpriced)'
      }
    ]
  },
  {
    no: '0041677707', customer: 'Airbus Helicopters, Inc.', date: '01/14/25',
    status: 'flow-down', statusKey: 'info',
    summary: 'Not a TPP order — Airbus to J. M. Fabrication. Received as a flow-down; DPAS rated.',
    parse: 'text layer · 5 pages', flagN: 3, flagSev: 'HIGH',
    po: 'docs/PO-0041677707.pdf', dwg: 'docs/DWG-217-305_G.pdf', dwgLabel: 'no matching print in library',
    header: [
      { k: 'BUYER', v: 'Airbus Helicopters, Inc., Grand Prairie TX' },
      { k: 'SUPPLIER ON PO', v: 'J. M. Fabrication Company, LLC · vendor 5039357' },
      { k: 'PO DATE', v: '12/05/2024 · changed 01/14/2025' },
      { k: 'CONTRACT', v: 'TF02072012' },
      { k: 'PO TOTAL', v: '17,529.20 USD' },
      { k: 'PO-WIDE', v: 'DPAS DO-A1 rated, prime W58RGZ-17-C-0010. No deviation from drawings without an approved AHI Quality Note.' }
    ],
    lines: [{
      no: 0, part: 'no TPP line', desc: 'Customer flow-down document', qty: '—', unit: '—',
      fields: [
        f('DOCUMENT TYPE', 'third-party PO'),
        f('TPP ROLE', 'sub-tier to J. M. Fabrication', 'not the supplier named on the order'),
        f('PRIORITY RATING', 'DPAS DO-A1', 'acknowledge within 15 days per 15 CFR 700', true),
        f('FLOW-DOWN', 'ER070-06-01 · QA/06-02-F04 · ER150-09-003'),
        f('QUOTE REFERENCE', 'RFQ60672384 · quote 3459', 'quote 4060 dated 05/05/2015 cited in header'),
        f('LINE ITEMS', 'not on pages 1–2', 'part lines sit later in the 5-page document', true)
      ],
      flags: [
        { sev: 'HIGH', title: 'Texas Precision Plating is not the supplier on this order', detail: 'The order runs from Airbus Helicopters to J. M. Fabrication Company, LLC. It reached TPP as a flow-down. No TPP line items can be created from it — the quotable order is J. M. Fabrication’s own PO, which has not arrived.', source: 'PO 0041677707 · supplier block' },
          { sev: 'HIGH', title: 'DPAS DO-A1 rating flows down to sub-tier', detail: 'A rated order must be accepted or rejected in writing within 15 days and takes scheduling priority over unrated work. The rating applies to TPP’s portion once a purchase order arrives.', source: 'PO 0041677707 · DPAS clause, 15 CFR 700' },
          { sev: 'MED', title: 'Pricing terms on this order are a decade old', detail: 'The header cites quote 4060 dated 05/05/2015, valid 2016 with a 1.5% increase through 2017. Any price carried forward from it should not be treated as current.', source: 'PO 0041677707 · header note' }
      ],
      priceState: 'not quotable', priceKey: 'info', priceNote: 'flow-down document — awaiting a purchase order addressed to TPP',
      openList: 'ACTION: acknowledge the DPAS rating; request J. M. Fabrication’s purchase order.'
    }]
  },
  {
    no: '243878', customer: 'Amphenol Fiber Systems Intl.', date: '08/05/26',
    status: 'unparsed', statusKey: 'grey',
    summary: 'Queued. Not yet extracted.',
    parse: 'pending', flagN: 0, flagSev: 'LOW',
    po: 'docs/PO-243878.pdf', dwg: 'docs/DWG-217-204_F.pdf', dwgLabel: '217-204 rev F',
    header: [{ k: 'STATUS', v: 'Queued for extraction' }],
    lines: []
  }
];

export const DWG_FOLDERS = [
  { key: 'all', label: 'All drawings' },
  { key: 'itar', label: 'ITAR' },
  { key: 'cui', label: 'CUI' },
  { key: 'open', label: 'Unrestricted' }
];

export const DWGS = [
  { cls: 'itar', clsNote: 'USML Cat XI · export controlled', no: '111-349', rev: 'A', title: 'Backshell, 90° plug', area: null, notes: 'Hard anodize MIL-A-8625 Type III Cl 2 black · passivate ASTM A-967 RoHS · dry film lube FSP-1034. Finish selected by dash number per FSP-1066.', pdf: 'docs/DWG-111-349_A.pdf' },
  { cls: 'cui', clsNote: 'CUI//SP-EXPT · handling per 32 CFR 2002', no: '217-102', rev: 'E', title: 'Insert retaining nut, SH13, M28', area: null, notes: 'Dimensional limits apply after finish. Material and finishing per FSP-1066. Thread table FSP-1067.', pdf: 'docs/DWG-217-102_E.pdf' },
  { cls: 'cui', clsNote: 'CUI//SP-EXPT · source controlled, DLA approval', no: '217-104', rev: 'H', title: 'WMR body, SH13', area: null, notes: 'Dimensions effective after plating. Finish AG/AH: cad plate must extend into I.D. to edge of groove. Source controlled — DLA approval required.', pdf: 'docs/DWG-217-104_H.pdf' },
  { cls: 'itar', clsNote: 'USML Cat XI · export controlled', no: '217-117', rev: 'C', title: '45° backshell / press sleeve assembly, SH13', area: null, notes: 'Assemble unplated components prior to plating. Install with FSTF0114, support with FSTF0823. Two components: 217-116 + 217-130.', pdf: 'docs/DWG-217-117_C.pdf' },
  { cls: 'itar', clsNote: 'USML Cat XI · source controlled', no: '217-204', rev: 'F', title: 'Plug body, SH13', area: '9.6', notes: 'Plating surface area estimate 9.6 in² stated on print. Dimensions effective after plating. Source controlled.', pdf: 'docs/DWG-217-204_F.pdf' },
  { cls: 'itar', clsNote: 'USML Cat XI · source controlled', no: '217-305', rev: 'G', title: 'Receptacle body, SH13', area: '20.8', notes: 'Plating surface area estimate 20.8 in² stated on print. Dimensional limits apply after finish. Source controlled.', pdf: 'docs/DWG-217-305_G.pdf' },
  { cls: 'open', clsNote: '', no: '217-311', rev: 'D', title: 'Shell component, SH13', area: null, notes: 'Material and finishing per FSP-1066.', pdf: 'docs/DWG-217-311_D.pdf' },
  { cls: 'cui', clsNote: 'CUI//SP-EXPT · redrawn from FS3M-660', no: '217-324', rev: 'J', title: 'Plug shell, redrawn from FS3M-660', area: '20.8', notes: 'Plating surface area estimate 20.8 in² stated on print. Finish AG/AH: cad plate must extend into I.D. to edge of grooves.', pdf: 'docs/DWG-217-324_J.pdf' }
];

export const QUOTE_ROWS = [
  ['Q-26-0412', '243875', '111-349-2', 'Hard anodize · MIL-A-8625 III/2', '104', null, 'area', '$3.7500', '$390.00', 'open', '3 inputs open', 0],
  ['Q-26-0413', '243877', '217-102-BL0', 'Hard anodize · MIL-A-8625 III/2', '500', '≈3.4', 'area', '$1.8000', '$900.00', 'open', '2 inputs open', 1],
  ['Q-26-0414', '243877', '217-104-4BL0', 'Hard anodize + PTFE · III/2', '30', null, 'area', '$2.7000', '$81.00', 'open', '3 inputs open', 1],
  ['Q-26-0415', '243877', '217-117-BL0', 'Hard anodize · MIL-A-8625 III/2', '320', null, 'area', '$4.0500', '$1,296.00', 'open', '3 inputs open', 1],
  ['Q-26-0416', '243879', '217-113-AH0', 'Cd over EN · QQ-P-416 / B733', '9', null, 'lb', '$10.8620', '$97.76', 'open', '3 inputs open', 2],
  ['Q-26-0417', '243879', 'FS3M-193-14', 'Cd over EN · spec not stated', '20', null, 'lb', '$10.8630', '$217.26', 'open', '4 inputs open', 2],
  ['Q-26-0418', '243880', 'FS5M-911-2', 'Passivate · ASTM A-967', '10', null, 'lot min', '$8.5000', '$85.00', 'ready', 'ready to price', 3],
  ['Q-26-0419', '243882', '217-101-1AU0', 'Electroless Ni · ASTM B733 IV/1', '10', null, 'area', '$4.0000', '$40.00', 'open', '2 inputs open', 4],
  ['Q-26-0420', '243882', '217-104-1HF0', 'Electroless Ni · ASTM B733 IV/1', '20', null, 'area', '$4.0000', '$80.00', 'open', '3 inputs open', 4],
  ['Q-26-0421', null, '217-204-BL0', 'Hard anodize · MIL-A-8625 III/2', '48', '9.6', 'area', '—', '—', 'open', 'parts received, no PO', null],
  ['Q-26-0409', '0041677707', 'flow-down', 'No TPP line items', '—', null, '—', '—', '—', 'info', 'not quotable', 5]
];

export const STEPS = [
  { title: 'Receiving count and lot identification', detail: 'Verify 320 pieces received and reconcile against the two lot numbers on the order.', ref: 'PO 243877 ln 3 · lot block', state: 'blocked' },
  { title: 'Drawing revision check', detail: 'Order calls rev C. Library copy is 217-117 rev C. Match confirmed automatically at intake.', ref: '217-117 rev C', state: 'done' },
  { title: 'Pre-plate assembly', detail: 'Install 217-130 press sleeve into 217-116 body using FSTF0114. Hold housing in FSTF0823 support tool. Components must be unplated at this step.', ref: '217-117 rev C · notes 1, 3, 4', state: 'locked' },
  { title: 'Press sleeve protrusion check', detail: 'Verify protrusion with sleeve fully seated, before the part enters the line.', ref: '217-117 rev C · note 2', state: 'locked' },
  { title: 'Masking', detail: 'No masking called out on the print or the order. Step recorded as not applicable rather than skipped.', ref: 'no callout found', state: 'na' },
  { title: 'Hard anodize', detail: 'MIL-A-8625 Type III Class 2, black. Total .0018–.0024 in, build-up .0009–.0012 in per surface.', ref: 'PO 243877 ln 3 · finish text', state: 'locked' },
  { title: 'Seal', detail: 'Per MIL-A-8625 Type III Class 2. No PTFE called on this line.', ref: 'MIL-A-8625F', state: 'locked' },
  { title: 'Thickness verification', detail: 'Verify build-up per surface against .0009–.0012 in. Record readings per lot.', ref: 'PO 243877 ln 3', state: 'locked' },
  { title: 'Final dimensional', detail: 'Dimensional limits apply after finish. Check against 217-117 rev C with the coating on.', ref: '217-117 rev C', state: 'locked' },
  { title: 'Certificate of conformance', detail: 'C of C and packing list required on every shipment. Cite AFSI clause guide Form 4-4.4-87 rev H, effective 07/27/26.', ref: 'PO 243877 · PO-wide clause', state: 'locked' },
  { title: 'Pack and ship', detail: 'Ship UPS #67730W. No shipment more than two weeks early without prior approval.', ref: 'PO 243877 · shipping note', state: 'locked' }
];

export const MAILS = [
  {
    from: 'Maciel Lopez', initials: 'ML', address: 'mlopez@amphenol-aerospace.com',
    address2: 'Amphenol Fiber Systems International',
    subject: 'PO 243875, 243877, 243878, 243879, 243880, 243882 — plating',
    time: '7:42 AM', received: 'Wed 08/05/26 7:42 AM', unread: true,
    preview: 'Doug — six orders attached, all plating. Same clause guide as last time.',
    body: 'Doug —\n\nSix orders attached, all plating. Same AFSI supplier quality clause guide as last time (Form 4-4.4-87 rev H, effective 07/27/26). C of C and packing list on every shipment.\n\n243877 line 2 — I do not have a current print for the WMR body, will send under separate cover.\n\nThanks,\nMaciel',
    attachments: [
      { kind: 'PO', name: '243875 TPP200 080526.pdf', detail: '1 line · 111-349-2 · hard anodize', parse: 'parsed', parseKey: 'ready' },
      { kind: 'PO', name: '243877 TPP200 080526.pdf', detail: '3 lines · hard anodize, 850 ea total', parse: 'parsed', parseKey: 'ready' },
      { kind: 'PO', name: '243878 TPP200 080526.pdf', detail: 'queued', parse: 'pending', parseKey: 'grey' },
      { kind: 'PO', name: '243879 TPP200 080526.pdf', detail: '2 lines · cadmium over electroless nickel', parse: 'parsed', parseKey: 'ready' },
      { kind: 'PO', name: '243880 TPP200 080526.pdf', detail: '1 line · 316 stainless passivate', parse: 'parsed', parseKey: 'ready' },
      { kind: 'PO', name: '243882 TPP200 080526.pdf', detail: '2 lines · electroless nickel', parse: 'parsed', parseKey: 'ready' }
    ],
    pricing: [
      ['111-349-2', '$3.7500', 'quoted 03/11/26 · PO 241902', 'current'],
      ['217-102-BL0', '$1.8000', 'quoted 11/04/24 · PO 238114', 'stale'],
      ['217-104-4BL0', '—', 'no pricing history', 'never'],
      ['217-117-BL0', '$4.0500', 'quoted 05/22/26 · PO 242760', 'current'],
      ['217-113-AH0', '$10.8620', 'quoted 07/18/23 · PO 231455', 'stale'],
      ['FS3M-193-14', '—', 'no pricing history', 'never'],
      ['FS5M-911-2', '$8.5000', 'quoted 02/09/26 · PO 241338', 'current'],
      ['217-101-1AU0', '$4.0000', 'quoted 01/27/25 · PO 239022', 'stale'],
      ['217-104-1HF0', '—', 'no pricing history', 'never']
    ],
    actionNote: 'All six pulled into print review. Five parsed, 243878 still extracting.',
    actionDetail: 'BLOCKING ACROSS THIS EMAIL: FSP-1066 not on file (6 lines) · 4 drawings missing from the library · print for 243877 ln 2 promised but not attached',
    btnLabel: 'open print review', btnKey: 'dark', goto: 'review'
  },
  {
    from: 'Kristen Boyd', initials: 'KB', address: 'kboyd@jmfabrication.com',
    address2: 'J. M. Fabrication Company, LLC',
    subject: 'FW: Airbus PO 0041677707 change 01/14/25 — pricing for your portion',
    time: 'Tue 4:18 PM', received: 'Tue 08/04/26 4:18 PM', unread: true,
    preview: 'Forwarding the Airbus order. Can you price your portion off this?',
    body: 'Forwarding the Airbus order for reference. Can you price your portion off this? Our PO will follow once we have your number.\n\nNote this one is rated.\n\nKristen',
    attachments: [
      { kind: 'PO', name: 'po 0041677707.pdf', detail: '5 pages · Airbus Helicopters → J. M. Fabrication · 17,529.20 USD', parse: 'parsed', parseKey: 'ready' }
    ],
    pricing: [],
    actionNote: 'Third-party order. TPP is not the supplier named on it.',
    actionDetail: 'ACTION: acknowledge the DPAS DO-A1 rating in writing within 15 days per 15 CFR 700 · request J. M. Fabrication’s own purchase order · header cites quote 4060 dated 05/05/2015, do not carry that pricing forward',
    btnLabel: 'draft reply', btnKey: 'red', goto: 'review'
  },
  {
    from: 'Maciel Lopez', initials: 'ML', address: 'mlopez@amphenol-aerospace.com',
    address2: 'Amphenol Fiber Systems International',
    subject: 'RE: 217-104 revision level',
    time: 'Mon 11:05 AM', received: 'Mon 08/03/26 11:05 AM', unread: false,
    preview: 'Latest I have is rev H, 06/12/2024. Checking whether FSP-1066 can be released.',
    body: 'Latest I have is rev H dated 06/12/2024 — attaching it.\n\nOn FSP-1066: it is controlled, I am checking whether it can be released to a supplier or whether we send you an extract of the relevant rows only. Give me a couple of days.\n\nMaciel',
    attachments: [
      { kind: 'DWG', name: '217-104_H.pdf', detail: 'WMR body, SH13 · rev H · source controlled, DLA approval required', parse: 'filed to library', parseKey: 'ready' }
    ],
    pricing: [['217-104-4BL0', '—', 'no pricing history', 'never']],
    actionNote: 'Drawing filed. FSP-1066 release still pending with the customer.',
    actionDetail: 'FSP-1066 is the single document blocking the most lines in the queue — six lines defer material and finish selection to it.',
    btnLabel: 'open drawing library', btnKey: 'plain', goto: 'drawings'
  }
];

export const SPECS = [
  ['MIL-A-8625', 'F', 'Anodic coatings for aluminium and aluminium alloys', 'current', 'ready', '111-349 · 217-102 · 217-117 · PO 243875, 243877'],
  ['ASTM B733', '-15', 'Autocatalytic nickel-phosphorus coatings on metal', 'current', 'ready', 'PO 243879 ln 1 · PO 243882 ln 1, ln 2'],
  ['SAE-QQ-P-416', 'F', 'Cadmium plating, electrodeposited', 'current', 'ready', 'PO 243879 ln 1'],
  ['ASTM A967', '-17', 'Chemical passivation treatments for stainless steel', 'current', 'ready', 'PO 243880 ln 1 · 111-349 finish note 2'],
  ['AMS 2759/9', 'E', 'Hydrogen embrittlement relief bake, plated parts', 'current', 'ready', 'referenced by QQ-P-416 bake requirement'],
  ['FSP-1034', '—', 'AFSI dry film lubricant specification', 'not on file', 'open', '111-349 finish note 3'],
  ['FSP-1066', '—', 'AFSI material and finish selection table', 'not on file', 'open', '6 live lines defer material and finish to it'],
  ['FSP-1067', '—', 'AFSI thread specification table', 'not on file', 'review', '217-102 rev E note'],
  ['Form 4-4.4-87', 'H', 'AFSI supplier quality clause guide, eff. 07/27/26', 'current', 'ready', 'every Amphenol purchase order']
];

export const PROCS = [
  ['QP-4.4', 'K', 'Contract review and order acceptance', '06/2026', 'ok', 'RFQ inbox · planning development'],
  ['QP-8.3', 'G', 'First article inspection, AS9102', '03/2026', 'ok', 'all lines with FAI required'],
  ['QP-8.5', 'J', 'Certificate of conformance and record retention', '05/2026', 'ok', 'every shipment'],
  ['WI-RACK-02', 'D', 'Racking and load configuration', '01/2026', 'ok', 'hard anodize, electroless nickel'],
  ['WI-ANO-03', 'H', 'Hard anodize operation, Type III', '07/2026', 'ok', '217-102 · 217-117 · 111-349'],
  ['WI-MSK-01', 'F', 'Masking application and removal', '08/2024', 'stale', 'no live job — due for review'],
  ['WI-BAKE-02', 'E', 'Hydrogen embrittlement relief bake', '02/2026', 'ok', 'cadmium and EN on steel'],
  ['WI-INSP-05', 'C', 'Coating thickness verification', '04/2026', 'ok', 'every plated traveler'],
  ['WI-PASS-01', 'B', 'Passivation, citric and nitric methods', '11/2023', 'stale', 'PO 243880 — planning drafted against this']
];

export const BTN = {
  dark: "font-family:'Space Mono',monospace; font-size:10.5px; letter-spacing:0.04em; padding:6px 13px; border-radius:3px; border:1px solid #16161A; background:#16161A; color:#FFF; cursor:pointer",
  red: `font-family:'Space Mono',monospace; font-size:10.5px; letter-spacing:0.04em; padding:6px 13px; border-radius:3px; border:1px solid ${RED}; background:${RED}; color:#FFF; cursor:pointer`,
  plain: "font-family:'Space Mono',monospace; font-size:10.5px; letter-spacing:0.04em; padding:6px 13px; border-radius:3px; border:1px solid #E1E1E4; background:#FFF; color:#4A4A52; cursor:pointer"
};

export const JOBS = [
  {
    ref: 'PO 243877 · LN 3', part: '217-117-BL0', proc: 'Hard anodize · MIL-A-8625F Type III Cl 2 black', qty: '320',
    state: 'released to traveler', stateKey: 'ready',
    sources: [
      ['PURCHASE ORDER', 'PO 243877 rev C', 'accepted 08/14/26 · $4.0500 ea', 'ok'],
      ['DRAWING', '217-117 rev C', 'library copy matches the order', 'ok'],
      ['PRIOR WORKFLOW', 'WO 24-1188 · 05/2026', '108 pieces, same finish, no rework', 'ok'],
      ['STEELHEAD SPEC', 'HA-III-BLK rev 7', 'current as of 08/26 load', 'ok']
    ],
    route: ['Receiving', 'Pre-plate assembly', 'Protrusion check', 'Hard anodize', 'Seal', 'Thickness verify', 'Final dimensional', 'C of C', 'Ship'],
    note: 'Agent lifted the pre-plate assembly step from note 1 on the print and the FSTF0114 / FSTF0823 tooling from notes 3 and 4. Sequence matches WO 24-1188 with one addition: thickness verification is now recorded per lot rather than per work order.',
    basis: 'PO 243877 ln 3 · 217-117 rev C notes 1–4 · WO 24-1188 · Steelhead process HA-III-BLK rev 7',
    footNote: 'Approved by C. Ramirez 08/15/26. One open hold on the traveler.',
    btnLabel: 'open traveler', btnKey: 'dark', goto: 'inspect'
  },
  {
    ref: 'PO 243880 · LN 1', part: 'FS5M-911-2', proc: 'Passivate · ASTM A-967 · 316 stainless', qty: '10',
    state: 'awaiting planner review', stateKey: 'review',
    sources: [
      ['PURCHASE ORDER', 'PO 243880 rev —', 'accepted 08/19/26 · $8.5000 ea', 'ok'],
      ['DRAWING', 'FS5M-911-1 rev C', 'not in the library', 'gap'],
      ['PRIOR WORKFLOW', 'WO 23-0742 · 11/2023', 'same part, 25 pieces, citric method', 'ok'],
      ['STEELHEAD SPEC', 'PASS-A967 rev 3', 'current as of 08/26 load', 'ok']
    ],
    route: ['Receiving', 'Degrease', 'Passivate — citric', 'Rinse / dry', 'Visual', 'C of C', 'Ship'],
    note: 'The order names ASTM A-967 without specifying a method. The agent carried the citric process forward from WO 23-0742 rather than choosing one, and has marked the decision for a planner. RoHS language is carried onto the certificate per the order line.',
    basis: 'PO 243880 ln 1 · WO 23-0742 · Steelhead process PASS-A967 rev 3 · no drawing on file',
    footNote: 'Method inherited from history, not from the order. A planner has to confirm citric before release.',
    btnLabel: 'review draft', btnKey: 'plain', goto: 'review'
  },
  {
    ref: 'PO 243877 · LN 1', part: '217-102-BL0', proc: 'Hard anodize · Type III Cl 2 black', qty: '500',
    state: 'awaiting planner review', stateKey: 'review',
    sources: [
      ['PURCHASE ORDER', 'PO 243877 rev C', 'accepted 08/14/26 · $1.8000 ea', 'ok'],
      ['DRAWING', '217-102 rev E', 'library copy matches the order', 'ok'],
      ['PRIOR WORKFLOW', 'WO 24-0913 · 11/2024', '250 pieces, racked 40 per load', 'ok'],
      ['STEELHEAD SPEC', 'HA-III-BLK rev 7', 'current as of 08/26 load', 'ok']
    ],
    route: ['Receiving', 'Rack 40/load', 'Deox', 'Hard anodize', 'Seal', 'Thickness verify', 'Final dimensional', 'C of C', 'Ship'],
    note: 'The order writes the spec as MIL-PRF-8625, which does not exist. The agent planned against MIL-A-8625F, consistent with the Type III Class 2 and .0018–.0024 in callouts, and raised the correction rather than silently accepting it. At 500 pieces the draft carries 13 loads against the 40-per-rack figure from WO 24-0913.',
    basis: 'PO 243877 ln 1 · 217-102 rev E · WO 24-0913 · Steelhead process HA-III-BLK rev 7',
    footNote: 'Spec correction needs customer confirmation in writing before this releases.',
    btnLabel: 'review draft', btnKey: 'plain', goto: 'review'
  },
  {
    ref: 'PO 243882 · LN 2', part: '217-104-1HF0', proc: 'Electroless nickel · ASTM B733 · 316 stainless', qty: '20',
    state: 'agent blocked', stateKey: 'open',
    sources: [
      ['PURCHASE ORDER', 'PO 243882 rev —', 'accepted 08/20/26 · $4.0000 ea', 'ok'],
      ['DRAWING', '217-104 rev H', 'library copy matches the order', 'ok'],
      ['PRIOR WORKFLOW', 'none', 'this dash number has never run', 'gap'],
      ['STEELHEAD SPEC', 'EN-B733-II rev 5', 'no rev covering .0001–.0002 in', 'gap']
    ],
    route: ['Receiving', 'Degrease', 'Wood’s strike — unpriced', 'Electroless nickel', 'Thickness verify', 'C of C', 'Ship'],
    note: 'No planning can be finalized. The ordered thickness of .0001–.0002 in falls below every grade in the Steelhead B733 spec table, and the order calls Type IV — the zincate class for aluminium — on a 316 stainless part. The agent has drafted the route with a Wood’s nickel strike, which the order does not mention and which carries no priced operation.',
    basis: 'PO 243882 ln 2 · 217-104 rev H · Steelhead spec table EN-B733 · no work-order history for this dash',
    footNote: 'Two conflicts must clear with the customer before a planner can sign anything.',
    btnLabel: 'open conflicts', btnKey: 'red', goto: 'review'
  },
  {
    ref: 'PO 243879 · LN 1', part: '217-113-AH0', proc: 'Cadmium over electroless nickel · QQ-P-416 / B733', qty: '9',
    state: 'agent blocked', stateKey: 'open',
    sources: [
      ['PURCHASE ORDER', 'PO 243879 rev —', 'accepted 08/20/26 · $10.8620 ea', 'ok'],
      ['DRAWING', '217-113-A40 rev G', 'not in the library', 'gap'],
      ['PRIOR WORKFLOW', 'WO 21-0455 · 03/2021', 'ran under a superseded spec revision', 'gap'],
      ['STEELHEAD SPEC', 'CD-QQP416-II rev 9', 'bake band depends on base material', 'gap']
    ],
    route: ['Receiving', 'Degrease', 'Electroless nickel', 'Cadmium', 'Chromate — olive drab', 'Bake — duration undetermined', 'Thickness verify ×2', 'C of C', 'Ship'],
    note: 'The embrittlement relief bake cannot be planned. QQ-P-416 sets the bake by base material and strength, the base material is deferred to FSP-1066, and FSP-1066 is not on file. The agent has held the step in the route with no duration rather than dropping it. The 2021 history ran under a superseded spec revision and was not carried forward.',
    basis: 'PO 243879 ln 1 · no drawing · Steelhead spec CD-QQP416-II rev 9 · WO 21-0455 superseded',
    footNote: 'Blocked on FSP-1066 and the missing print. Bake duration is the pricing risk.',
    btnLabel: 'open conflicts', btnKey: 'red', goto: 'review'
  }
];

export const ST_STYLE = {
  done:    { chip: chip(GREEN, '#EFF7F3', '#C9E3D8'), label: 'signed', badge: GREEN, btn: 'view' },
  blocked: { chip: chip(RED, '#FFF1F0', '#F0CFCB'), label: 'hold', badge: RED, btn: 'resolve' },
  locked:  { chip: chip('#9A9AA2', '#F4F4F5', '#E1E1E4'), label: 'locked', badge: '#C6C6CC', btn: 'locked' },
  na:      { chip: chip('#6B6B72', '#F4F4F5', '#E1E1E4'), label: 'n/a', badge: '#9A9AA2', btn: 'view' }
};
