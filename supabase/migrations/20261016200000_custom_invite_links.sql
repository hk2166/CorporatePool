-- Custom invite links: an admin can give a link a name people can read and type,
-- /invite/palwal-gurgaon, instead of the random /invite/Zq8_x-AbCdEfGhIjKlMnOpQr, and can let
-- any number of people join through it until it ends. A named link is easy to guess, so it's
-- meant for links shared openly in the group for a limited time; random links stay the default.
--
-- Names: 4 to 40 lowercase letters, digits and hyphens, starting and ending with a letter or
-- digit. "No limit" on people is stored as 10,000 (lib/invites.ts NO_LIMIT).

alter table public.signup_tokens drop constraint signup_tokens_token_check;
alter table public.signup_tokens add constraint signup_tokens_token_check
  check (token ~ '^[A-Za-z0-9_-]{22,}$' or token ~ '^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$');

alter table public.signup_tokens drop constraint signup_tokens_max_uses_check;
alter table public.signup_tokens add constraint signup_tokens_max_uses_check
  check (max_uses between 1 and 10000);
