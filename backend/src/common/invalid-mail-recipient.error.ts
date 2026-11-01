export class InvalidMailRecipientError extends Error {
  constructor(message = 'Mail recipient must be a single valid email address') {
    super(message);
    this.name = 'InvalidMailRecipientError';
  }
}
