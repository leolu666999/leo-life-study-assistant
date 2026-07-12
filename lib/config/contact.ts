import "server-only";

export function developerContact() {
  return {
    email: process.env.DEVELOPER_CONTACT_EMAIL?.trim() || null,
    phone: process.env.DEVELOPER_CONTACT_PHONE?.trim() || null
  };
}
