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
        width={28}
        height={28}
        referrerPolicy="no-referrer"
        className="size-7 shrink-0 rounded-full border border-stone-200 object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand font-mono text-[11px] font-semibold text-white"
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
          className="flex min-w-0 items-center gap-2 rounded-full border border-stone-200 bg-stone-50 py-0.5 pr-1 pl-0.5 text-sm text-stone-700 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none md:pr-3"
        >
          <Avatar user={user} />
          <span className="hidden max-w-40 truncate md:inline">{user.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate font-medium text-stone-900">{user.name}</span>
            <span className="block truncate font-mono text-xs text-stone-500">{user.email}</span>
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
