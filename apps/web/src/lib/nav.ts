import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  Flag,
  LayoutDashboard,
  Medal,
  Scale,
  Shield,
  Trophy,
  Users,
  Building2,
  LineChart,
  ScrollText,
  UserRound,
  BookOpen,
  FlaskConical,
  ClipboardCheck,
  Award,
} from "lucide-react";

export const NAV: Record<
  string,
  Array<{ href: string; label: string; icon: typeof Users }>
> = {
  FEDERATION: [
    { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
    { href: "/users", label: "Учётные записи", icon: Shield },
    { href: "/athletes", label: "Спортсмены", icon: Users },
    { href: "/coaches", label: "Тренеры", icon: UserRound },
    { href: "/judges", label: "Судьи", icon: Scale },
    { href: "/organizations", label: "Организации", icon: Building2 },
    { href: "/catalogs", label: "Справочники", icon: BookOpen },
    { href: "/calendar", label: "Календарь", icon: CalendarDays },
    { href: "/applications", label: "Заявки", icon: ClipboardList },
    { href: "/results", label: "Результаты и протоколы", icon: ClipboardCheck },
    { href: "/ranks", label: "Разряды", icon: Medal },
    { href: "/judge-categories", label: "Судейские категории", icon: Shield },
    { href: "/ratings", label: "Рейтинг", icon: Trophy },
    { href: "/national-team", label: "Сборная", icon: Flag },
    { href: "/documents", label: "Документы", icon: FileText },
    { href: "/reports", label: "Отчёты", icon: ScrollText },
    { href: "/development", label: "Развитие вида спорта", icon: LineChart },
    { href: "/notifications", label: "Уведомления", icon: Bell },
    { href: "/audit", label: "Журнал действий", icon: ScrollText },
  ],
  MINISTRY: [
    { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
    { href: "/athletes", label: "Реестр спортсменов", icon: Users },
    { href: "/calendar", label: "Календарь", icon: CalendarDays },
    { href: "/ratings", label: "Рейтинг", icon: Trophy },
    { href: "/reports", label: "Отчёты", icon: ScrollText },
    { href: "/development", label: "Развитие вида спорта", icon: LineChart },
  ],
  ATHLETE: [
    { href: "/me", label: "Мой профиль", icon: UserRound },
    { href: "/my-disciplines", label: "Мои дисциплины", icon: BookOpen },
    { href: "/my-coaches", label: "Мои тренеры", icon: UserRound },
    { href: "/calendar", label: "Календарь", icon: CalendarDays },
    { href: "/my-applications", label: "Мои заявки", icon: ClipboardList },
    { href: "/my-results", label: "Мои результаты", icon: Trophy },
    { href: "/my-rating", label: "Мой рейтинг", icon: Award },
    { href: "/my-rank", label: "Мой разряд", icon: Medal },
    { href: "/anti-doping", label: "Антидопинг", icon: FlaskConical },
    { href: "/documents", label: "Документы", icon: FileText },
    { href: "/notifications", label: "Уведомления", icon: Bell },
  ],
  COACH: [
    { href: "/coach-athletes", label: "Мои спортсмены", icon: Users },
    { href: "/calendar", label: "Календарь", icon: CalendarDays },
    { href: "/applications", label: "Заявки", icon: ClipboardList },
    { href: "/my-results", label: "Результаты подопечных", icon: Trophy },
    { href: "/ranks", label: "Разряды подопечных", icon: Medal },
    { href: "/documents", label: "Справки", icon: FileText },
    { href: "/notifications", label: "Уведомления", icon: Bell },
  ],
  JUDGE: [
    { href: "/judge-profile", label: "Мой профиль", icon: Scale },
    { href: "/calendar", label: "Мои соревнования", icon: CalendarDays },
    { href: "/judge-categories", label: "Категория", icon: Shield },
    { href: "/notifications", label: "Уведомления", icon: Bell },
  ],
};

const extras: Record<string, Array<{href:string;label:string;icon:typeof Users}>> = {
  FEDERATION: [{href:'/training',label:'Спортивная подготовка',icon:Users},{href:'/standards',label:'Нормативы и аттестация',icon:Medal},{href:'/appeals',label:'Апелляции и нарушения',icon:Scale},{href:'/governor-awards',label:'Премии Губернатора',icon:Award},{href:'/integrations',label:'ФСП ID и интеграции',icon:Shield},{href:'/judging-documents',label:'Документы судей',icon:FileText},{href:'/journey',label:'Путь спортсмена',icon:Flag}],
  COACH: [{href:'/training',label:'Учебные группы',icon:Users},{href:'/standards',label:'Нормативы и аттестация',icon:Medal},{href:'/appeals',label:'Апелляции',icon:Scale},{href:'/journey',label:'Путь спортсмена',icon:Flag}],
  ATHLETE: [{href:'/standards',label:'Мои нормативы',icon:Medal},{href:'/appeals',label:'Апелляции',icon:Scale},{href:'/journey',label:'Мой спортивный путь',icon:Flag}],
  JUDGE: [{href:'/appeals',label:'Нарушения',icon:Scale},{href:'/judging-documents',label:'Документы судьи',icon:FileText}],
  MINISTRY: [{href:'/national-team',label:'Сборная региона',icon:Flag},{href:'/governor-awards',label:'Премии',icon:Award},{href:'/judging-documents',label:'Документы судей',icon:FileText}],
};
for(const [role,items] of Object.entries(extras)) NAV[role].push(...items);
for(const role of Object.keys(NAV)) NAV[role].push({href:'/team-scenarios',label:'Сценарии команды',icon:ClipboardList});
for(const role of Object.keys(NAV)) NAV[role].push({href:'/public/guide',label:'Справочник и навигатор',icon:BookOpen});

export const ROLE_LABEL: Record<string, string> = {
  FEDERATION: "Федерация",
  ATHLETE: "Спортсмен",
  COACH: "Тренер",
  JUDGE: "Судья",
  MINISTRY: "Министерство",
};
