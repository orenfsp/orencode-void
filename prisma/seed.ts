import {
  ApplicationStatus,
  CalendarPlanType,
  CompetitionFormat,
  CompetitionLevel,
  OrganizationType,
  PrismaClient,
  PublicationStatus,
  RatingBand,
  RoleCode,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_RATING_POINTS,
  DISCIPLINE_NAMES,
  STABILITY_COEFFICIENT,
} from "@fsp/shared";
import { computeSeasonRating } from "../apps/api/src/ratings/rating.engine";

if (process.getBuiltinModule("fs").existsSync(".env"))
  process.loadEnvFile(".env");
const prisma = new PrismaClient();
const PASSWORD = "Demo1234!";

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Демонстрационное заполнение запрещено в production");
  if (await prisma.user.count()) {
    console.log(
      "База уже содержит пользователей. Демонстрационное заполнение пропущено; данные сохранены.",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const roles = await Promise.all(
    (
      [
        [RoleCode.FEDERATION, "Федерация"],
        [RoleCode.ATHLETE, "Спортсмен"],
        [RoleCode.COACH, "Тренер"],
        [RoleCode.JUDGE, "Судья"],
        [RoleCode.MINISTRY, "Министерство"],
      ] as const
    ).map(([code, name]) => prisma.role.create({ data: { code, name } })),
  );
  const roleId = Object.fromEntries(
    roles.map((item) => [item.code, item.id]),
  ) as Record<RoleCode, string>;

  const disciplineDescriptions: Record<string, string> = {
    ALGORITHMIC:
      "Олимпиадная и спортивная алгоритмика: индивидуальные и командные турниры.",
    PRODUCT:
      "Продуктовое программирование: командная разработка цифрового продукта по заданию.",
    INFOSEC: "Защита информационных систем, криптография и кибербезопасность.",
    AI: "Машинное обучение, компьютерное зрение и прикладные системы искусственного интеллекта.",
    ROBOTICS:
      "Автономные робототехнические комплексы и соревновательные задачи.",
    UAV: "Беспилотные авиационные системы: программирование, навигация и применение.",
  };
  const disciplines = await Promise.all(
    (Object.entries(DISCIPLINE_NAMES) as Array<[string, string]>).map(
      ([code, name]) =>
        prisma.discipline.create({
          data: { code, name, description: disciplineDescriptions[code] },
        }),
    ),
  );
  const d = Object.fromEntries(disciplines.map((item) => [item.code, item]));

  const orgs = await prisma.$transaction([
    prisma.organization.create({
      data: {
        name: "СШОР «Алгоритм»",
        type: OrganizationType.SPORTS_SCHOOL,
        municipality: "Оренбург",
        address: "ул. Советская, 10",
      },
    }),
    prisma.organization.create({
      data: {
        name: "Клуб «Код Урала»",
        type: OrganizationType.CLUB,
        municipality: "Орск",
      },
    }),
    prisma.organization.create({
      data: {
        name: "ОГУ, факультет ИТ",
        type: OrganizationType.UNIVERSITY,
        municipality: "Оренбург",
      },
    }),
  ]);

  const ageGroups = await prisma.$transaction([
    prisma.ageGroup.create({
      data: { code: "U14", name: "до 14 лет", maxAge: 13 },
    }),
    prisma.ageGroup.create({
      data: { code: "U18", name: "14–17 лет", minAge: 14, maxAge: 17 },
    }),
    prisma.ageGroup.create({
      data: { code: "JUNIOR", name: "18–20 лет", minAge: 18, maxAge: 20 },
    }),
    prisma.ageGroup.create({
      data: { code: "ADULT", name: "21+", minAge: 21 },
    }),
  ]);
  const types = await prisma.$transaction([
    prisma.competitionType.create({
      data: { code: "CHAMPIONSHIP", name: "Чемпионат" },
    }),
    prisma.competitionType.create({
      data: { code: "PERVENSTVO", name: "Первенство" },
    }),
    prisma.competitionType.create({ data: { code: "CUP", name: "Кубок" } }),
  ]);

  async function user(data: {
    email: string;
    lastName: string;
    firstName: string;
    middleName?: string;
    roles: RoleCode[];
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        lastName: data.lastName,
        firstName: data.firstName,
        middleName: data.middleName,
        roles: { create: data.roles.map((code) => ({ roleId: roleId[code] })) },
      },
    });
  }

  const federation = await user({
    email: "federation@fsp-orenburg.demo",
    lastName: "Соколова",
    firstName: "Мария",
    middleName: "Игоревна",
    roles: [RoleCode.FEDERATION],
  });
  await user({
    email: "federation2@fsp-orenburg.demo",
    lastName: "Громов",
    firstName: "Илья",
    middleName: "Андреевич",
    roles: [RoleCode.FEDERATION],
  });
  const ministry = await user({
    email: "ministry@fsp-orenburg.demo",
    lastName: "Белов",
    firstName: "Павел",
    roles: [RoleCode.MINISTRY],
  });
  await user({
    email: "ministry2@fsp-orenburg.demo",
    lastName: "Ветрова",
    firstName: "Ольга",
    roles: [RoleCode.MINISTRY],
  });
  const athleteUser = await user({
    email: "athlete@fsp-orenburg.demo",
    lastName: "Иванов",
    firstName: "Артём",
    middleName: "Сергеевич",
    roles: [RoleCode.ATHLETE],
  });
  const athlete2User = await user({
    email: "athlete2@fsp-orenburg.demo",
    lastName: "Петрова",
    firstName: "Дарья",
    roles: [RoleCode.ATHLETE],
  });
  const athlete3User = await user({
    email: "athlete3@fsp-orenburg.demo",
    lastName: "Смирнов",
    firstName: "Илья",
    roles: [RoleCode.ATHLETE],
  });
  const coachUser = await user({
    email: "coach@fsp-orenburg.demo",
    lastName: "Кузнецов",
    firstName: "Олег",
    middleName: "Викторович",
    roles: [RoleCode.COACH],
  });
  const judgeUser = await user({
    email: "judge@fsp-orenburg.demo",
    lastName: "Орлова",
    firstName: "Елена",
    roles: [RoleCode.JUDGE],
  });
  const judge2User = await user({
    email: "judge2@fsp-orenburg.demo",
    lastName: "Тарасов",
    firstName: "Денис",
    middleName: "Олегович",
    roles: [RoleCode.JUDGE],
  });
  const multiUser = await user({
    email: "multi@fsp-orenburg.demo",
    lastName: "Никитин",
    firstName: "Максим",
    roles: [RoleCode.ATHLETE, RoleCode.COACH],
  });

  const coach = await prisma.coach.create({
    data: {
      userId: coachUser.id,
      lastName: coachUser.lastName,
      firstName: coachUser.firstName,
      middleName: coachUser.middleName,
      organizationId: orgs[0].id,
      disciplines: {
        create: [{ disciplineId: d.ALGORITHMIC.id }, { disciplineId: d.AI.id }],
      },
    },
  });
  await prisma.coach.create({
    data: {
      userId: multiUser.id,
      lastName: multiUser.lastName,
      firstName: multiUser.firstName,
      organizationId: orgs[1].id,
      disciplines: { create: [{ disciplineId: d.PRODUCT.id }] },
    },
  });

  const judge = await prisma.judge.create({
    data: {
      userId: judgeUser.id,
      lastName: judgeUser.lastName,
      firstName: judgeUser.firstName,
    },
  });
  await prisma.judgeCategory.createMany({
    data: [
      {
        judgeId: judge.id,
        categoryCode: "Вторая категория",
        assignedAt: new Date("2019-02-01"),
        expiresAt: new Date("2023-02-01"),
        orderNumber: "СК-04",
        assignedById: federation.id,
      },
      {
        judgeId: judge.id,
        categoryCode: "Первая категория",
        assignedAt: new Date("2023-03-01"),
        expiresAt: new Date("2027-03-01"),
        orderNumber: "СК-12",
        assignedById: federation.id,
      },
    ],
  });
  const judge2 = await prisma.judge.create({
    data: {
      userId: judge2User.id,
      lastName: judge2User.lastName,
      firstName: judge2User.firstName,
      middleName: judge2User.middleName,
    },
  });
  await prisma.judgeCategory.create({
    data: {
      judgeId: judge2.id,
      categoryCode: "Вторая категория",
      assignedAt: new Date("2024-04-10"),
      expiresAt: new Date("2026-11-20"),
      orderNumber: "СК-21",
      assignedById: federation.id,
    },
  });
  await prisma.judgeCategoryApplication.create({
    data: {
      judgeId: judge2.id,
      submittedById: judge2User.id,
      requestedCategory: "Первая категория",
      status: "PENDING",
    },
  });

  const athletes = await Promise.all([
    prisma.athlete.create({
      data: {
        userId: athleteUser.id,
        lastName: athleteUser.lastName,
        firstName: athleteUser.firstName,
        middleName: athleteUser.middleName,
        birthDate: new Date("2008-04-12"),
        municipality: "Оренбург",
        organizationId: orgs[0].id,
        startedYear: 2023,
        disciplines: { create: [{ disciplineId: d.ALGORITHMIC.id }] },
      },
    }),
    prisma.athlete.create({
      data: {
        userId: athlete2User.id,
        lastName: athlete2User.lastName,
        firstName: athlete2User.firstName,
        birthDate: new Date("2009-11-02"),
        municipality: "Орск",
        organizationId: orgs[1].id,
        startedYear: 2022,
        disciplines: {
          create: [
            { disciplineId: d.ALGORITHMIC.id },
            { disciplineId: d.AI.id },
          ],
        },
      },
    }),
    prisma.athlete.create({
      data: {
        userId: athlete3User.id,
        lastName: athlete3User.lastName,
        firstName: athlete3User.firstName,
        birthDate: new Date("2012-01-20"),
        municipality: "Бузулук",
        organizationId: orgs[0].id,
        startedYear: 2024,
        guardianName: "Смирнова Анна",
        guardianPhone: "+7 900 000-00-01",
        disciplines: { create: [{ disciplineId: d.ROBOTICS.id }] },
      },
    }),
    prisma.athlete.create({
      data: {
        userId: multiUser.id,
        lastName: multiUser.lastName,
        firstName: multiUser.firstName,
        birthDate: new Date("2001-07-15"),
        municipality: "Оренбург",
        organizationId: orgs[2].id,
        startedYear: 2022,
        disciplines: { create: [{ disciplineId: d.PRODUCT.id }] },
      },
    }),
    prisma.athlete.create({
      data: {
        lastName: "Козлов",
        firstName: "Тимур",
        birthDate: new Date("2005-02-01"),
        municipality: "Новотроицк",
        organizationId: orgs[1].id,
        startedYear: 2023,
        disciplines: { create: [{ disciplineId: d.INFOSEC.id }] },
      },
    }),
    prisma.athlete.create({
      data: {
        lastName: "Белова",
        firstName: "Полина",
        birthDate: new Date("1999-09-18"),
        municipality: "Оренбург",
        organizationId: orgs[2].id,
        startedYear: 2022,
        disciplines: {
          create: [{ disciplineId: d.PRODUCT.id }, { disciplineId: d.AI.id }],
        },
      },
    }),
  ]);

  await prisma.consent.createMany({
    data: [
      {
        subjectType: "ATHLETE",
        athleteId: athletes[0].id,
        userId: athleteUser.id,
        consentType: "PERSONAL_DATA",
        version: "2026-01",
        grantedByUserId: athleteUser.id,
      },
      {
        subjectType: "ATHLETE",
        athleteId: athletes[1].id,
        userId: athlete2User.id,
        consentType: "PERSONAL_DATA",
        version: "2026-01",
        grantedByUserId: athlete2User.id,
      },
      {
        subjectType: "ATHLETE",
        athleteId: athletes[2].id,
        userId: athlete3User.id,
        consentType: "PERSONAL_DATA",
        version: "2026-01",
        grantedByUserId: federation.id,
        representativeName: "Смирнова Анна",
        representativeRelation: "мать",
      },
    ],
  });
  await prisma.antiDopingRecord.createMany({
    data: [
      {
        athleteId: athletes[0].id,
        courseName: "РУСАДА. Базовый курс (демо)",
        completedAt: new Date("2025-09-01"),
        certificateNumber: "RUSADA-DEMO-1",
      },
      {
        athleteId: athletes[1].id,
        courseName: "РУСАДА. Базовый курс (демо)",
        completedAt: new Date("2026-02-10"),
        certificateNumber: "RUSADA-DEMO-2",
      },
    ],
  });

  const link = await prisma.coachAthlete.create({
    data: {
      coachId: coach.id,
      athleteId: athletes[0].id,
      disciplineId: d.ALGORITHMIC.id,
      status: "ACTIVE",
      confirmedAt: new Date(),
    },
  });
  await prisma.coachAthleteStatusHistory.create({
    data: {
      coachAthleteId: link.id,
      toStatus: "ACTIVE",
      changedById: athletes[0].userId!,
    },
  });
  const pendingLink = await prisma.coachAthlete.create({
    data: {
      coachId: coach.id,
      athleteId: athletes[1].id,
      disciplineId: d.AI.id,
      status: "PENDING",
    },
  });
  await prisma.coachAthleteStatusHistory.create({
    data: {
      coachAthleteId: pendingLink.id,
      toStatus: "PENDING",
      changedById: coachUser.id,
    },
  });

  await prisma.sportsRank.createMany({
    data: [
      {
        athleteId: athletes[0].id,
        rankType: "Второй юношеский разряд",
        assignedAt: new Date("2022-05-20"),
        expiresAt: new Date("2024-05-20"),
        orderNumber: "Р-17",
        assignedById: federation.id,
      },
      {
        athleteId: athletes[0].id,
        rankType: "Третий юношеский разряд",
        assignedAt: new Date("2024-06-01"),
        expiresAt: new Date("2026-12-01"),
        orderNumber: "Р-41",
        assignedById: federation.id,
      },
      {
        athleteId: athletes[1].id,
        rankType: "Второй юношеский разряд",
        assignedAt: new Date("2024-09-10"),
        expiresAt: new Date("2026-11-15"),
        orderNumber: "Р-52",
        assignedById: federation.id,
      },
      {
        athleteId: athletes[4].id,
        rankType: "Третий спортивный разряд",
        assignedAt: new Date("2025-04-12"),
        expiresAt: new Date("2027-04-12"),
        orderNumber: "Р-61",
        assignedById: federation.id,
      },
      {
        athleteId: athletes[5].id,
        rankType: "Кандидат в мастера спорта",
        assignedAt: new Date("2024-10-01"),
        expiresAt: new Date("2026-12-20"),
        orderNumber: "Р-63",
        assignedById: federation.id,
      },
    ],
  });
  await prisma.rankRequirement.create({
    data: {
      rankType: "Третий юношеский разряд",
      description:
        "Место подключения нормативных данных ЕВСК. Нормативы не выдуманы.",
      sourceNote: "Требуется официальная выписка ЕВСК",
      isActive: false,
    },
  });

  for (const season of [2025, 2026]) {
    for (const [band, places] of Object.entries(DEFAULT_RATING_POINTS)) {
      for (const [place, points] of Object.entries(places)) {
        await prisma.ratingRule.create({
          data: {
            season,
            band: band as RatingBand,
            place: Number(place),
            points,
          },
        });
      }
    }
  }

  const past = await prisma.competition.create({
    data: {
      name: "Чемпионат Оренбургской области — алгоритмическое программирование",
      disciplineId: d.ALGORITHMIC.id,
      typeId: types[0].id,
      level: CompetitionLevel.REGIONAL,
      format: CompetitionFormat.IN_PERSON,
      ageGroupId: ageGroups[1].id,
      startsAt: new Date("2025-11-15"),
      endsAt: new Date("2025-11-16"),
      venue: "Оренбург, Дворец спорта",
      publicationStatus: PublicationStatus.PUBLISHED,
      applicationsOpenAt: new Date("2025-09-01"),
      applicationsCloseAt: new Date("2025-11-01"),
      calendarPlanType: CalendarPlanType.REGIONAL,
      calendarPlanNumber: "КП-2025-12",
      ratingBand: RatingBand.REGIONAL,
      season: 2025,
      createdById: federation.id,
    },
  });
  const past2 = await prisma.competition.create({
    data: {
      name: "Межрегиональный кубок «Южный Урал»",
      disciplineId: d.ALGORITHMIC.id,
      typeId: types[2].id,
      level: CompetitionLevel.INTERREGIONAL,
      format: CompetitionFormat.HYBRID,
      ageGroupId: ageGroups[1].id,
      startsAt: new Date("2026-03-20"),
      endsAt: new Date("2026-03-21"),
      venue: "Орск / онлайн",
      publicationStatus: PublicationStatus.PUBLISHED,
      applicationsOpenAt: new Date("2026-01-10"),
      applicationsCloseAt: new Date("2026-03-01"),
      calendarPlanType: CalendarPlanType.INTERREGIONAL,
      ratingBand: RatingBand.INTERREGIONAL,
      season: 2026,
      createdById: federation.id,
    },
  });
  const open = await prisma.competition.create({
    data: {
      name: "Первенство области по ИИ",
      disciplineId: d.AI.id,
      typeId: types[1].id,
      level: CompetitionLevel.REGIONAL,
      format: CompetitionFormat.ONLINE,
      ageGroupId: ageGroups[1].id,
      startsAt: new Date("2026-12-05"),
      endsAt: new Date("2026-12-06"),
      venue: "онлайн",
      publicationStatus: PublicationStatus.PUBLISHED,
      applicationsOpenAt: new Date("2026-09-01"),
      applicationsCloseAt: new Date("2026-11-20"),
      calendarPlanType: CalendarPlanType.REGIONAL,
      ratingBand: RatingBand.REGIONAL,
      season: 2026,
      createdById: federation.id,
    },
  });
  const national = await prisma.competition.create({
    data: {
      name: "Всероссийские соревнования по продуктовому программированию",
      disciplineId: d.PRODUCT.id,
      typeId: types[0].id,
      level: CompetitionLevel.NATIONAL,
      format: CompetitionFormat.ONLINE,
      ageGroupId: ageGroups[3].id,
      startsAt: new Date("2026-05-15"),
      endsAt: new Date("2026-05-16"),
      venue: "онлайн",
      publicationStatus: PublicationStatus.PUBLISHED,
      applicationsOpenAt: new Date("2026-02-01"),
      applicationsCloseAt: new Date("2026-04-20"),
      calendarPlanType: CalendarPlanType.FEDERAL,
      calendarPlanNumber: "КП-2026-Ф-03",
      ratingBand: RatingBand.RUSSIA_CHAMPIONSHIP,
      season: 2026,
      createdById: federation.id,
    },
  });

  async function application(
    competitionId: string,
    athleteId: string,
    submittedById: string,
    status: ApplicationStatus,
    reason?: string,
  ) {
    const reviewed = status === "APPROVED" || status === "REJECTED";
    const created = await prisma.competitionApplication.create({
      data: {
        competitionId,
        athleteId,
        submittedById,
        status,
        rejectionReason: reason,
        reviewedById: reviewed ? federation.id : null,
      },
    });
    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: created.id,
        toStatus: status,
        changedById: reviewed ? federation.id : submittedById,
        comment: reason,
      },
    });
    return created;
  }

  const a1 = await application(
    past.id,
    athletes[0].id,
    athleteUser.id,
    "APPROVED",
  );
  const a2 = await application(
    past.id,
    athletes[1].id,
    athlete2User.id,
    "APPROVED",
  );
  const a3 = await application(
    past2.id,
    athletes[0].id,
    athleteUser.id,
    "APPROVED",
  );
  const a4 = await application(
    past2.id,
    athletes[1].id,
    athlete2User.id,
    "APPROVED",
  );
  await application(open.id, athletes[1].id, athlete2User.id, "PENDING");
  await application(open.id, athletes[0].id, athleteUser.id, "APPROVED");
  await application(open.id, athletes[2].id, athlete3User.id, "WITHDRAWN");
  await application(
    open.id,
    athletes[4].id,
    athleteUser.id,
    "REJECTED",
    "Нет подтверждённого разряда для допуска",
  );
  const a5 = await application(
    national.id,
    athletes[3].id,
    multiUser.id,
    "APPROVED",
  );
  const a6 = await application(
    national.id,
    athletes[5].id,
    multiUser.id,
    "APPROVED",
  );

  async function result(
    competitionId: string,
    athleteId: string,
    applicationId: string,
    place: number,
    score: number,
    season: number,
  ) {
    return prisma.competitionResult.create({
      data: {
        competitionId,
        athleteId,
        applicationId,
        place,
        score,
        status: "PUBLISHED",
        createdById: federation.id,
        updatedById: federation.id,
      },
    });
  }
  const r1 = await result(past.id, athletes[0].id, a1.id, 1, 280, 2025);
  const r2 = await result(past.id, athletes[1].id, a2.id, 2, 240, 2025);
  const r3 = await result(past2.id, athletes[0].id, a3.id, 2, 210, 2026);
  const r4 = await result(past2.id, athletes[1].id, a4.id, 1, 255, 2026);
  const r5 = await result(national.id, athletes[3].id, a5.id, 1, 96, 2026);
  const r6 = await result(national.id, athletes[5].id, a6.id, 2, 91, 2026);

  await prisma.competitionProtocol.create({
    data: {
      competitionId: past.id,
      number: "П-2025-001",
      status: "PUBLISHED",
      publishedAt: new Date("2025-11-16"),
      publishedById: federation.id,
    },
  });
  await prisma.competitionProtocol.create({
    data: {
      competitionId: past2.id,
      number: "П-2026-004",
      status: "PUBLISHED",
      publishedAt: new Date("2026-03-21"),
      publishedById: federation.id,
    },
  });
  await prisma.competitionProtocol.create({
    data: {
      competitionId: national.id,
      number: "П-2026-Ф-011",
      status: "PUBLISHED",
      publishedAt: new Date("2026-05-16"),
      publishedById: federation.id,
    },
  });

  await prisma.judgeAssignment.createMany({
    data: [
      {
        judgeId: judge.id,
        competitionId: past.id,
        position: "Главный судья",
        assignedById: federation.id,
      },
      {
        judgeId: judge.id,
        competitionId: past2.id,
        position: "Главный судья",
        assignedById: federation.id,
      },
      {
        judgeId: judge2.id,
        competitionId: past2.id,
        position: "Секретарь",
        assignedById: federation.id,
      },
      {
        judgeId: judge.id,
        competitionId: national.id,
        position: "Главный судья",
        assignedById: federation.id,
      },
    ],
  });

  const rules2026 = await prisma.ratingRule.findMany({
    where: { season: 2026 },
  });
  const computed = computeSeasonRating(
    [
      {
        competitionId: past2.id,
        resultId: r3.id,
        place: 2,
        band: "INTERREGIONAL",
      },
    ],
    rules2026,
    false,
  );
  const rating = await prisma.athleteSeasonRating.create({
    data: {
      athleteId: athletes[0].id,
      disciplineId: d.ALGORITHMIC.id,
      season: 2026,
      totalPoints: computed.totalPoints,
      stabilityApplied: computed.stabilityApplied,
      prizeCount: computed.prizeCount,
    },
  });
  await prisma.athleteRatingEntry.createMany({
    data: computed.entries.map((entry) => ({
      seasonRatingId: rating.id,
      competitionId: entry.competitionId,
      resultId: entry.resultId,
      basePoints: entry.basePoints,
      coefficient: entry.coefficient,
      finalPoints: entry.finalPoints,
    })),
  });
  const computed2 = computeSeasonRating(
    [
      {
        competitionId: past2.id,
        resultId: r4.id,
        place: 1,
        band: "INTERREGIONAL",
      },
    ],
    rules2026,
    false,
  );
  const rating2 = await prisma.athleteSeasonRating.create({
    data: {
      athleteId: athletes[1].id,
      disciplineId: d.ALGORITHMIC.id,
      season: 2026,
      totalPoints: computed2.totalPoints,
      stabilityApplied: computed2.stabilityApplied,
      prizeCount: computed2.prizeCount,
    },
  });
  await prisma.athleteRatingEntry.createMany({
    data: computed2.entries.map((entry) => ({
      seasonRatingId: rating2.id,
      competitionId: entry.competitionId,
      resultId: entry.resultId,
      basePoints: entry.basePoints,
      coefficient: entry.coefficient,
      finalPoints: entry.finalPoints,
    })),
  });

  const rules2025 = await prisma.ratingRule.findMany({
    where: { season: 2025 },
  });
  for (const [athleteId, resultId, competitionId, place] of [
    [athletes[0].id, r1.id, past.id, 1],
    [athletes[1].id, r2.id, past.id, 2],
  ] as const) {
    const computed2025 = computeSeasonRating(
      [{ competitionId, resultId, place, band: "REGIONAL" }],
      rules2025,
      false,
    );
    const seasonRating = await prisma.athleteSeasonRating.create({
      data: {
        athleteId,
        disciplineId: d.ALGORITHMIC.id,
        season: 2025,
        totalPoints: computed2025.totalPoints,
        stabilityApplied: computed2025.stabilityApplied,
        prizeCount: computed2025.prizeCount,
      },
    });
    await prisma.athleteRatingEntry.createMany({
      data: computed2025.entries.map((entry) => ({
        seasonRatingId: seasonRating.id,
        competitionId: entry.competitionId,
        resultId: entry.resultId,
        basePoints: entry.basePoints,
        coefficient: entry.coefficient,
        finalPoints: entry.finalPoints,
      })),
    });
  }

  const nationalRating = computeSeasonRating(
    [
      {
        competitionId: national.id,
        resultId: r5.id,
        place: 1,
        band: "RUSSIA_CHAMPIONSHIP",
      },
    ],
    rules2026,
    false,
  );
  const productRating = await prisma.athleteSeasonRating.create({
    data: {
      athleteId: athletes[3].id,
      disciplineId: d.PRODUCT.id,
      season: 2026,
      totalPoints: nationalRating.totalPoints,
      stabilityApplied: nationalRating.stabilityApplied,
      prizeCount: nationalRating.prizeCount,
    },
  });
  await prisma.athleteRatingEntry.createMany({
    data: nationalRating.entries.map((entry) => ({
      seasonRatingId: productRating.id,
      competitionId: entry.competitionId,
      resultId: entry.resultId,
      basePoints: entry.basePoints,
      coefficient: entry.coefficient,
      finalPoints: entry.finalPoints,
    })),
  });

  const team = await prisma.nationalTeam.create({
    data: {
      season: 2026,
      disciplineId: d.ALGORITHMIC.id,
      ageGroupId: ageGroups[1].id,
      title: "Сборная Оренбургской области, алгоритмическое программирование",
      createdById: federation.id,
      members: {
        create: [
          { athleteId: athletes[1].id, source: "RATING" },
          {
            athleteId: athletes[0].id,
            source: "MANUAL",
            note: "Решение федерации",
          },
        ],
      },
    },
  });
  await prisma.nationalTeamMemberHistory.create({
    data: {
      teamId: team.id,
      athleteId: athletes[0].id,
      action: "ADD",
      userId: federation.id,
    },
  });
  const productTeam = await prisma.nationalTeam.create({
    data: {
      season: 2026,
      disciplineId: d.PRODUCT.id,
      ageGroupId: ageGroups[3].id,
      title: "Сборная Оренбургской области, продуктовое программирование",
      createdById: federation.id,
      members: {
        create: [{ athleteId: athletes[3].id, source: "RATING" }],
      },
    },
  });
  await prisma.nationalTeamMemberHistory.create({
    data: {
      teamId: productTeam.id,
      athleteId: athletes[3].id,
      action: "ADD",
      userId: federation.id,
      payload: { source: "RATING" },
    },
  });

  await prisma.participationCertificate.create({
    data: {
      verificationToken: "demo-certificate-token-2025",
      number: "СП-2025-DEMO0001",
      athleteId: athletes[0].id,
      competitionId: past.id,
      resultId: r1.id,
      issuedById: federation.id,
      issuedAt: new Date("2025-12-01"),
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: athleteUser.id,
        type: "PROTOCOL_PUBLISHED",
        title: "Опубликован протокол",
        body: "Опубликован протокол чемпионата области.",
      },
      {
        userId: federation.id,
        type: "APPLICATION_SUBMITTED",
        title: "Новая заявка",
        body: "Требуется рассмотрение заявки на первенство по ИИ.",
      },
      {
        userId: athlete2User.id,
        type: "RANK_EXPIRING",
        title: "Скоро истекает спортивный разряд",
        body: "Разряд «Второй юношеский разряд» действует до 15.11.2026.",
      },
      {
        userId: judge2User.id,
        type: "JUDGE_CATEGORY_EXPIRING",
        title: "Скоро истекает судейская категория",
        body: "Категория «Вторая категория» действует до 20.11.2026.",
      },
      {
        userId: athleteUser.id,
        type: "APPLICATIONS_CLOSING",
        title: "Скоро заканчивается приём заявок",
        body: "Приём заявок на первенство области по ИИ завершится 20.11.2026.",
      },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      {
        userId: federation.id,
        action: "SEED",
        entityType: "System",
        entityId: "demo",
        context: {
          note: "Демонстрационные данные загружены",
          coefficient: STABILITY_COEFFICIENT,
        },
      },
      {
        userId: federation.id,
        action: "COMPETITION_CREATE",
        entityType: "Competition",
        entityId: past.id,
        changes: { name: past.name },
      },
      {
        userId: federation.id,
        action: "PROTOCOL_PUBLISH",
        entityType: "CompetitionProtocol",
        entityId: `${past.id}-protocol`,
        changes: { competition: past.name },
      },
      {
        userId: federation.id,
        action: "NATIONAL_TEAM_UPSERT",
        entityType: "NationalTeam",
        entityId: team.id,
      },
    ],
  });

  void r1;
  void r2;
  void r6;
  void productTeam;
  void ministry;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
