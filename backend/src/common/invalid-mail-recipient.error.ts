export class InvalidMailRecipientError extends Error {
  constructor() {
    super('Mail recipient must be a single valid email address');
    this.name = 'InvalidMailRecipientError';
  }
}
