import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Globe, Receipt, CheckSquare, FileText, ClipboardList, Building2, Settings, LogOut, ShieldCheck,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/session";

const adminItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Websites", url: "/websites", icon: Globe },
  { title: "Custos", url: "/costs", icon: Receipt },
  { title: "Aprovações", url: "/approvals", icon: CheckSquare },
  { title: "Faturas", url: "/invoices", icon: FileText },
  { title: "Tarefas", url: "/tasks", icon: ClipboardList },
];

const clientItems = [
  { title: "Portal", url: "/portal", icon: Building2 },
  { title: "Aprovações", url: "/approvals", icon: CheckSquare },
  { title: "Faturas", url: "/invoices", icon: FileText },
  { title: "Pedidos", url: "/tasks", icon: ClipboardList },
];

export function AppSidebar({ role, email }: { role: Role; email?: string | null }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const items = role === "admin" ? adminItems : clientItems;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-sidebar-foreground">ClientCare</span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                {role === "admin" ? "Agência" : "Cliente"}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Conta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/settings"}>
                  <Link to="/settings"><Settings className="h-4 w-4" /><span>Definições</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 space-y-2">
          {!collapsed && email && (
            <div className="text-xs text-sidebar-foreground/70 truncate">{email}</div>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && "Terminar sessão"}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}