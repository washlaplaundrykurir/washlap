export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "WashLap Laundry",
  description:
    "Sistem manajemen laundry dengan dashboard admin dan kurir. Kelola pesanan, penjemputan, dan pengantaran dengan mudah.",
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Login",
      href: "/login",
    },
  ],
  navMenuItems: [
    {
      label: "Dashboard",
      href: "/admin",
    },
    {
      label: "Login",
      href: "/login",
    },
  ],
  links: {
    github: "https://github.com/washlap",
  },
};
