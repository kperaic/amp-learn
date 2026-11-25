export type Locale = "hr" | "en";
export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  role: "super_admin" | "student";
  language: Locale;
  active: boolean;
};
