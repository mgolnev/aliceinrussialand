import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      displayName: "Алиса в Стране",
      tagline: "Иллюстрации и наброски",
      bio: "Авторский канал работ.",
      aboutMarkdown:
        "Здесь — иллюстрации, процесс и заметки. Связаться можно в соцсетях ниже.",
      telegramChannelUser: "Fox_outside_the_box",
      socialLinksJson: JSON.stringify([
        {
          id: "1",
          label: "Telegram",
          url: "https://t.me/",
          kind: "telegram",
        },
        {
          id: "2",
          label: "Behance",
          url: "https://www.behance.net/",
          kind: "behance",
        },
      ]),
    },
    update: {},
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
