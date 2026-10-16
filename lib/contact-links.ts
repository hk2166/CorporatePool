// Links for the confirmed view (F-D8): call, WhatsApp and pay by UPI. Phones are stored in
// E.164 form ("+919876543210", F-A2).

// tel:+919876543210
export function callLink(phone: string): string {
  return `tel:${phone}`;
}

// A WhatsApp chat with that number, optionally with a message typed in.
export function whatsappLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  return text
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}`;
}

// Opens the rider's UPI app with the owner's UPI ID and the amount filled in. The app takes no
// part in the payment and never sees it (D6).
export function upiLink({
  vpa,
  name,
  amount,
  note = "CorporatePool ride",
}: {
  vpa: string;
  name: string;
  amount: number;
  note?: string;
}): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: name,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note,
  });
  // UPI apps expect %20 for spaces (not "+") and a plain @ in the UPI ID.
  return `upi://pay?${params.toString().replace(/\+/g, "%20").replace(/%40/g, "@")}`;
}
