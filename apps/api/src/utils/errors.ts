// 🚨 apps/api/src/utils/errors.ts
// Hierarchie d'erreurs applicatives.
//
// Le principe : le client recoit une information utile et rien d'interne,
// le serveur garde la trace complete. Toute exception qui n'herite pas
// d'AppError est traitee comme une erreur interne et ne divulgue jamais sa cause.

export class AppError extends Error {
  constructor(
    /** Code metier stable, exploitable par le client pour afficher un message. */
    readonly code: string,
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class QuotaExhaustedError extends AppError {
  constructor() {
    super('QUOTA_EXHAUSTED', 409, 'Plus aucune pose disponible sur cette pellicule');
  }
}

export class ConsentRequiredError extends AppError {
  constructor() {
    super('CONSENT_REQUIRED', 403, "Le droit a l'image doit etre accepte avant toute prise de vue");
  }
}

export class EventClosedError extends AppError {
  constructor() {
    super('EVENT_CLOSED', 409, "La prise de vue est terminee pour cet evenement");
  }
}

export class EventFullError extends AppError {
  constructor() {
    super('EVENT_FULL', 409, "Cet evenement a atteint son nombre maximal de participants");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentification requise') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Vous n'avez pas les droits necessaires") {
    super('FORBIDDEN', 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Ressource') {
    super('NOT_FOUND', 404, `${resource} introuvable`);
  }
}
