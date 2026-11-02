// Each participant's private "edit code" is issued by the server when they first submit
// and kept in this browser only. It lets them change their response later from the same
// device; knowing someone's email address is not enough to read or change their answer.

const key = (eventToken: string, email: string) =>
  `klokk-edit:${eventToken}:${email.trim().toLowerCase()}`;

export function getEditToken(eventToken: string, email: string): string | undefined {
  try {
    return localStorage.getItem(key(eventToken, email)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setEditToken(eventToken: string, email: string, editToken: string): void {
  try {
    localStorage.setItem(key(eventToken, email), editToken);
  } catch {
    /* storage unavailable: the participant simply cannot edit from this browser */
  }
}
