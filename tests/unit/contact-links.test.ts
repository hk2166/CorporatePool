import { describe, expect, it } from "vitest";
import { callLink, upiLink, whatsappLink } from "@/lib/contact-links";

describe("callLink", () => {
  it("dials the number", () => {
    expect(callLink("+919876543210")).toBe("tel:+919876543210");
  });
});

describe("whatsappLink", () => {
  it("opens a chat with the number, digits only", () => {
    expect(whatsappLink("+919876543210")).toBe("https://wa.me/919876543210");
  });
  it("can fill in a message", () => {
    expect(whatsappLink("+919876543210", "Hi, I'm at the gate")).toBe(
      "https://wa.me/919876543210?text=Hi%2C%20I'm%20at%20the%20gate",
    );
  });
});

describe("upiLink", () => {
  it("fills in the UPI ID, name and amount", () => {
    expect(upiLink({ vpa: "demo@upi", name: "Demo Owner", amount: 150 })).toBe(
      "upi://pay?pa=demo@upi&pn=Demo%20Owner&am=150.00&cu=INR&tn=CorporatePool%20ride",
    );
  });
});
