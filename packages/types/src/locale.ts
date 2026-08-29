// packages/types/src/locale.ts
// Messages de validation en francais.
//
// Zod ecrit ses messages par defaut en anglais. Sans ce fichier, un invite
// francophone lit « Invalid email » ou « String must contain at least 3
// character(s) » : c'est le genre de detail qui trahit un produit fini a la
// hate. La carte est posee une seule fois, dans le paquet partage, donc les
// messages du serveur et ceux du client sont les memes.

import { z, type ZodErrorMap } from 'zod';

const TYPES: Record<string, string> = {
  string: 'du texte', number: 'un nombre', boolean: 'oui ou non',
  date: 'une date', array: 'une liste', object: 'un objet',
};

const frenchErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') return { message: 'Ce champ est obligatoire' };
      return { message: `Valeur attendue : ${TYPES[issue.expected] ?? issue.expected}` };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Adresse electronique invalide' };
      if (issue.validation === 'url') return { message: 'Adresse internet invalide' };
      if (issue.validation === 'uuid') return { message: 'Identifiant invalide' };
      if (issue.validation === 'cuid') return { message: 'Identifiant invalide' };
      return { message: 'Format incorrect' };

    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return issue.minimum === 1
          ? { message: 'Ce champ est obligatoire' }
          : { message: `${issue.minimum} caracteres au moins` };
      }
      if (issue.type === 'number') return { message: `Le minimum est ${issue.minimum}` };
      if (issue.type === 'array') return { message: `${issue.minimum} element(s) au moins` };
      return { message: 'Valeur trop petite' };

    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `${issue.maximum} caracteres au plus` };
      if (issue.type === 'number') return { message: `Le maximum est ${issue.maximum}` };
      if (issue.type === 'array') return { message: `${issue.maximum} element(s) au plus` };
      return { message: 'Valeur trop grande' };

    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Choisissez une des valeurs proposees' };

    // z.coerce.date() sur une valeur inutilisable produit ce code, et non
    // invalid_type : c'est le cas des champs de date d'un formulaire vide.
    case z.ZodIssueCode.invalid_date:
      return { message: 'Date invalide' };

    case z.ZodIssueCode.not_multiple_of:
      return { message: `Doit etre un multiple de ${issue.multipleOf}` };

    case z.ZodIssueCode.unrecognized_keys:
      return { message: 'Champ inconnu' };

    case z.ZodIssueCode.invalid_literal:
      return { message: 'Valeur attendue differente' };

    default:
      // Les messages ecrits a la main dans les schemas passent par ici.
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(frenchErrorMap);
