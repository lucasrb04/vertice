"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials, userMenuItems } from "./user-menu-items";

export type UserMenuUser = {
  name: string;
  email: string;
  image: string | null;
  systemRole: "USER" | "SYSTEM_ADMIN";
};

function Avatar({ user }: { user: UserMenuUser }) {
  if (user.image) {
    return (
      // Foto do Google (lh3.googleusercontent.com): <img> simples, sem otimização do next/image.
      // biome-ignore lint/performance/noImgElement: avatar externo pequeno, sem ganho com next/image
      <img
        src={user.image}
        alt=""
        width={44}
        height={44}
        referrerPolicy="no-referrer"
        className="size-10 shrink-0 rounded-full object-cover sm:size-11"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rosa-soft text-sm font-bold text-rosa-ink sm:size-11"
    >
      {initials(user.name)}
    </span>
  );
}

/** Menu da conta no cabeçalho: atalhos para o que o usuário gere e o Sair. */
export function UserMenu({ user }: { user: UserMenuUser }) {
  // O formulário fica fora do menu: ao escolher um item, o Radix fecha o menu e desmonta o conteúdo
  // antes que o navegador envie um formulário que estivesse lá dentro.
  const signOutForm = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={signOutForm} action="/api/sign-out" method="post" hidden />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Menu da conta de ${user.name}`}
          className="flex shrink-0 items-center rounded-full transition-shadow hover:shadow-[0_0_0_3px_var(--line)]"
        >
          <Avatar user={user} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate font-semibold text-ink">{user.name}</span>
            <span className="block truncate text-sm text-ink-3">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {userMenuItems(user).map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>{item.label}</Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* POST em /api/sign-out encerra a sessão e redireciona para a home. */}
          <DropdownMenuItem onSelect={() => signOutForm.current?.requestSubmit()}>Sair</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
