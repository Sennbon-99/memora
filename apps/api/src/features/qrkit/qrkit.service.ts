// apps/api/src/features/qrkit/qrkit.service.ts
// Generation du kit imprimable.
//
// C'est le seul point de contact physique entre le produit et la soiree : si
// l'hote n'imprime pas ce kit, aucun invite ne peut entrer. Il doit donc
// fonctionner du premier coup, sans explication et sans installation.
//
// Le kit porte le carnet de la marque, jamais celui de la soiree. Deux
// raisons : un carnet sombre imprime consomme enormement d'encre, se salit et
// se photographie mal a la bougie ; et un seul habillage se dessine, se teste
// et s'imprime une fois pour toutes.

import type { Writable } from 'node:stream';
import { ZipArchive } from 'archiver';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { prisma } from '../../config/prisma.js';
import { buildPieces, type Card, type Piece, type PieceId } from './qrkit.cards.js';
import { assertCanManage } from '../events/event.service.js';

/** Le carnet de la marque, fige ici : le kit ne suit pas la soiree. */
const ENCRE = '#1A1A18';
const ENCRE_2 = '#4A4A42';
const ENCRE_3 = '#69675E';
const FILET = '#C2BEAF';
const ACCENT = '#D92F52';

/** Millimetres vers points PostScript. */
const mm = (valeur: number): number => (valeur * 72) / 25.4;

/**
 * Produit l'image du QR code.
 *
 * Niveau de correction H, et non M comme auparavant : H tolere environ trente
 * pour cent du code masque ou abime — M n'en tolere que quinze. C'est ce qui
 * autorise l'obturateur au centre, et ce qui sauve un carton tache de vin.
 *
 * La marge de quatre modules est le minimum de la specification. C'est
 * l'erreur la plus frequente et la plus couteuse : un code colle au bord d'un
 * cadre devient illisible pour une partie des telephones, et le graphiste ne
 * s'en apercoit jamais parce que le sien y arrive.
 */
async function renderQr(url: string, coteMm: number): Promise<Buffer> {
  // Trame a trois cents points par pouce pour la taille reellement imprimee,
  // plafonnee. Rasteriser un autocollant de trente-cinq millimetres a la meme
  // definition qu'une affiche A2 alourdissait la planche de vingt sans rien
  // ajouter : trois secondes de rendu pour un resultat identique.
  const largeur = Math.min(2000, Math.max(400, Math.round((coteMm / 25.4) * 300)));
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    margin: 4,
    width: largeur,
    color: { dark: ENCRE, light: '#FFFFFF' },
  });
}

/**
 * L'obturateur, pose au centre du code.
 *
 * Il ne couvre qu'un cinquieme de la largeur, tres en deca des trente pour
 * cent que le niveau H tolere. C'est lui qui rend le code reconnaissable
 * avant d'etre lu.
 */
function drawObturateur(doc: PDFKit.PDFDocument, cx: number, cy: number, cote: number): void {
  const r = cote * 0.105;
  doc.circle(cx, cy, r * 1.24).fill('#FFFFFF');
  doc.circle(cx, cy, r).fill(ENCRE);
  doc.circle(cx, cy, r * 0.54).fill('#FFFFFF');
  doc.circle(cx, cy, r * 0.24).fill(ENCRE);
}

/**
 * Le code presente comme un tirage : bord blanc epais, filet discret, legende
 * dessous. Le cadre porte l'identite, le code lui-meme reste standard.
 */
function drawTirage(
  doc: PDFKit.PDFDocument,
  qr: Buffer,
  x: number,
  y: number,
  cote: number,
  legende?: string,
): void {
  const marge = cote * 0.09;
  const basse = legende ? marge * 2.4 : marge;
  doc.rect(x - marge, y - marge, cote + marge * 2, cote + marge + basse)
    .fillAndStroke('#FFFFFF', FILET);
  doc.image(qr, x, y, { width: cote });
  drawObturateur(doc, x + cote / 2, y + cote / 2, cote);
  if (legende) {
    doc.fillColor(ENCRE_3).font('Helvetica').fontSize(Math.max(7, cote * 0.045))
      .text(legende, x - marge, y + cote + marge * 0.7, { align: 'center', width: cote + marge * 2 });
  }
}

/** Une affiche : un titre, un code, une consigne. Rien d'autre. */
function drawAffiche(doc: PDFKit.PDFDocument, card: Card, piece: Piece, qr: Buffer): void {
  const { width, height } = doc.page;
  const cote = mm(piece.qrMm);
  const echelle = cote / mm(120);

  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(11 * echelle)
    .text('MEMORA · 24 POSES · SANS COMPTE', 0, height * 0.1, {
      align: 'center', width, characterSpacing: 2 * echelle,
    });

  doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(30 * echelle)
    .text(card.title, mm(15), height * 0.16, { align: 'center', width: width - mm(30) });

  drawTirage(doc, qr, (width - cote) / 2, height * 0.34, cote);

  doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(19 * echelle)
    .text('Scannez, photographiez', 0, height * 0.34 + cote + mm(18), { align: 'center', width });
  doc.fillColor(ENCRE_2).font('Helvetica').fontSize(12 * echelle)
    .text("Vingt-quatre poses chacun. Aucune application a installer.", mm(20), height * 0.34 + cote + mm(28), {
      align: 'center', width: width - mm(40),
    });
  doc.fillColor(ENCRE_3).font('Helvetica').fontSize(8 * echelle)
    .text('Vos photos se revelent demain matin, toutes en meme temps.', mm(20), height - mm(22), {
      align: 'center', width: width - mm(40),
    });
}

/** Une carte de table ou un chevalet : le meme dessin, deux formats. */
function drawCarte(doc: PDFKit.PDFDocument, card: Card, piece: Piece, qr: Buffer): void {
  const { width, height } = doc.page;
  const cote = mm(piece.qrMm);

  doc.rect(0, 0, width, mm(4)).fill(ACCENT);
  doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(17)
    .text(card.title, mm(8), mm(12), { align: 'center', width: width - mm(16) });
  doc.fillColor(ENCRE_2).font('Helvetica').fontSize(10)
    .text(card.subtitle, mm(8), mm(19), { align: 'center', width: width - mm(16) });

  drawTirage(doc, qr, (width - cote) / 2, mm(27), cote);

  doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(11)
    .text('Scannez, photographiez', 0, height - mm(18), { align: 'center', width });
  doc.fillColor(ENCRE_3).font('Helvetica').fontSize(7.5)
    .text('Aucune application a installer', 0, height - mm(12), { align: 'center', width });
}

/**
 * La geometrie de la planche d'autocollants.
 *
 * Exportee parce qu'elle se verifie : un code carre pose dans un cercle de
 * decoupe ne tient que si sa diagonale reste sous le diametre — et il est
 * decale vers le haut pour loger le mot sous lui, ce qui rapproche encore ses
 * deux coins hauts du bord. La premiere version dessinait un code de 35 mm
 * dans un cercle de 48 : les coins depassaient de 2,2 mm, et un autocollant
 * decoupe aurait perdu ses reperes. Illisible, sur la piece qu'on colle aux
 * toilettes et que personne ne reverifie.
 */
export const PLANCHE = {
  colonnes: 4,
  lignes: 5,
  /** Pas de la grille. */
  pasMm: 50,
  /** Retrait du trait de decoupe par rapport au pas. */
  margeMm: 1,
  /** Decalage du code vers le haut, pour loger le mot sous lui. */
  decalageMm: 2,
} as const;

/** Une planche d'autocollants ronds, a coller la ou l'on sort son telephone. */
function drawPlanche(doc: PDFKit.PDFDocument, piece: Piece, qr: Buffer): void {
  const { width } = doc.page;
  const cote = mm(piece.qrMm);
  const pas = mm(PLANCHE.pasMm);
  const { colonnes, lignes } = PLANCHE;
  const gaucheX = (width - colonnes * pas) / 2;
  const hautY = mm(24);

  doc.fillColor(ENCRE_3).font('Helvetica').fontSize(8)
    .text('Decoupez et collez : toilettes, bar, photobooth.', 0, mm(14), { align: 'center', width });

  for (let ligne = 0; ligne < lignes; ligne += 1) {
    for (let colonne = 0; colonne < colonnes; colonne += 1) {
      const cx = gaucheX + colonne * pas + pas / 2;
      const cy = hautY + ligne * pas + pas / 2;
      doc.circle(cx, cy, pas / 2 - mm(PLANCHE.margeMm)).lineWidth(0.5).stroke(FILET);
      doc.image(qr, cx - cote / 2, cy - cote / 2 - mm(PLANCHE.decalageMm), { width: cote });
      drawObturateur(doc, cx, cy - mm(PLANCHE.decalageMm), cote);
      doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(5.5)
        .text('SCANNEZ', cx - pas / 2, cy + cote / 2 - mm(1), { align: 'center', width: pas });
    }
  }
}

/**
 * Assemble une piece complete en un PDF.
 *
 * Exportee pour etre rendue par les tests : pdfkit leve sur une coordonnee
 * invalide, et une piece qui ne se dessine pas ne se voit qu au moment ou
 * l hote la telecharge.
 */
export async function buildPiece(piece: Piece): Promise<Buffer> {
  const doc = new PDFDocument({
    size: piece.format,
    layout: piece.orientation,
    margin: 0,
    autoFirstPage: false,
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  if (piece.id === 'autocollants') {
    doc.addPage();
    drawPlanche(doc, piece, await renderQr(piece.cards[0]!.url, piece.qrMm));
  } else {
    for (const card of piece.cards) {
      doc.addPage();
      const qr = await renderQr(card.url, piece.qrMm);
      if (piece.id.startsWith('affiche')) {
        drawAffiche(doc, card, piece, qr);
      } else {
        drawCarte(doc, card, piece, qr);
      }
    }
  }

  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function chargerPieces(eventId: string, userId: string, demandees: PieceId[]) {
  const { event } = await assertCanManage(eventId, userId);
  const tables = event.useTableCodes
    ? await prisma.eventTable.findMany({
        where: { eventId },
        orderBy: { label: 'asc' },
        select: { label: true, qrToken: true },
      })
    : [];
  return { event, pieces: buildPieces(event, tables, demandees) };
}

/** Une seule piece : un PDF, telecharge tel quel. */
export async function generatePiece(
  eventId: string, userId: string, demandee: PieceId,
): Promise<{ nom: string; pdf: Buffer }> {
  const { pieces } = await chargerPieces(eventId, userId, [demandee]);
  const piece = pieces[0]!;
  return { nom: `memora-${piece.id}.pdf`, pdf: await buildPiece(piece) };
}

/**
 * Plusieurs pieces : une archive, un fichier par piece.
 *
 * On n'imprime pas une A3 et huit A5 sur la meme machine, ni au meme moment.
 * Un PDF unique aux pages de tailles differentes est par ailleurs refuse par
 * une partie des services d'impression.
 */
export async function streamKit(
  eventId: string, userId: string, demandees: PieceId[], output: Writable,
): Promise<void> {
  const { pieces } = await chargerPieces(eventId, userId, demandees);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.pipe(output);

  for (const piece of pieces) {
    archive.append(await buildPiece(piece), { name: `memora-${piece.id}.pdf` });
  }

  await archive.finalize();
}
