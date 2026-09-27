interface Props {
  message: string;
  contactEmail: string | null;
}

export function DisabledAccountNotice({ message, contactEmail }: Props) {
  return (
    <p className="text-danger text-sm" role="alert">
      {message}
      {contactEmail && (
        <>
          {' '}
          <a className="underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </>
      )}
    </p>
  );
}
