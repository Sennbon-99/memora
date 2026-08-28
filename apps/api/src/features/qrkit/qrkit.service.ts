// apps/api/src/features/qrkit/qrkit.service.ts
// Generation du kit de QR codes imprimable.
//
// L'hote telecharge un PDF pret a imprimer, aux couleurs de son evenement,
// et le pose sur les tables. C'est le seul point de contact physique entre
// le produit et la soiree : il doit fonctionner du premier coup, sans
// explication et sans installation.

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { assertCanManage } from '../events/event.service.js';

/** Adresse encodee dans le QR code, avec la table si elle est connue. */
function buildJoinUrl(slug: string, tableToken?: string): string {
  const base = `${env.CLIENT_URL}/e/${slug}`;
  return tableToken ? `${base}?t=${tableToken}` : base;
}

/**
 * Produit l'image du QR code.
 *
 * Le niveau de correction M tolere trente pour cent de dommage : un chevalet
 * taché de vin ou plié reste scannable. La marge de quatre modules est le
 * minimum requis par la specification pour que les scanners detectent le code.
 */
async function renderQr(url: string, color: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 600,
    color: { dark: color, light: '#FFFFFF' },
  });
}

interface Card {
  title: string;
  subtitle: string;
  url: string;
}

/**
 * Assemble le PDF : une carte par page, au format A5 paysage, qui se plie
 * en chevalet une fois imprimee.
 */
async function buildPdf(cards: Card[], eventName: string, color: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A5', layout: 'landscape', margin: 0 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  for (const [index, card] of cards.entries()) {
    if (index > 0) doc.addPage();

    const { width, height } = doc.page;
    const qr = await renderQr(card.url, color);

    // Bandeau de couleur en haut, pour que le chevalet soit reconnaissable
    // de loin sur une table.
    doc.rect(0, 0, width, 14).fill(color);

    doc.fillColor('#131313')
      .font('Helvetica-Bold').fontSize(20)
      .text(card.title, 0, 40, { align: 'center', width });

    doc.fillColor('#6E6E6E')
      .font('Helvetica').fontSize(11)
      .text(card.subtitle, 0, 66, { align: 'center', width });

    const qrSize = 150;
    doc.image(qr, (width - qrSize) / 2, 90, { width: qrSize });

    doc.fillColor('#131313').font('Helvetica-Bold').fontSize(12)
      .text('Scannez, photographiez', 0, height - 70, { align: 'center', width });
    doc.fillColor('#8A8A8A').font('Helvetica').fontSize(9)
      .text('Aucune application a installer', 0, height - 52, { align: 'center', width });
    doc.fillColor('#B9B9B9').fontSize(7.5)
      .text(eventName, 0, height - 24, { align: 'center', width });
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Kit complet d'un evenement.
 *
 * Deux cas. Si l'hote a choisi un code unique, le kit tient en une carte a
 * poser a l'entree. S'il a cree des tables, il obtient une carte par table,
 * chacune portant son propre jeton : les statistiques par table en decoulent
 * sans que l'invite ait rien a saisir.
 */
export async function generateKit(eventId: string, userId: string): Promise<Buffer> {
  const { event } = await assertCanManage(eventId, userId);

  const tables = event.useTableCodes
    ? await prisma.eventTable.findMany({
        where: { eventId },
        orderBy: { label: 'asc' },
        select: { label: true, qrToken: true },
      })
    : [];

  const cards: Card[] =
    tables.length > 0
      ? tables.map((table) => ({
          title: event.name,
          subtitle: table.label,
          url: buildJoinUrl(event.slug, table.qrToken),
        }))
      : [{
          title: event.name,
          subtitle: 'Bienvenue',
          url: buildJoinUrl(event.slug),
        }];

  return buildPdf(cards, event.name, event.color);
}
