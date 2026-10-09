/**
 * Floating owner bar on the public site: toggle inline editing, jump to the
 * dashboard, log out. Rendered only for an authenticated owner.
 */
import { Link } from "react-router-dom";

import { useLogout } from "@/api/auth";
import { useUnreadCount } from "@/api/admin";
import { Button } from "@/ui/Button";
import { Toggle } from "@/ui/form/inputs";
import { Icon } from "@/ui/Icon";

import { useSudo } from "./SudoProvider";
import styles from "./SudoBar.module.css";

export function SudoBar() {
  const { isOwner, editing, setEditing } = useSudo();
  const logout = useLogout();
  const unread = useUnreadCount(isOwner);
  if (!isOwner) return null;

  return (
    <aside className={styles.bar} aria-label="Owner tools">
      <span className={styles.prompt}>
        <Icon name="shield" size={16} />
        sudo
      </span>
      <Toggle checked={editing} onChange={setEditing} label="Edit page" id="sudo-edit-toggle" />
      <Link to="/sudo" className={styles.link}>
        Dashboard
        {unread.data?.unread ? <span className={styles.count}>{unread.data.unread}</span> : null}
      </Link>
      <Button size="sm" variant="ghost" iconOnly icon="logout" aria-label="Log out"
        loading={logout.isPending} onClick={() => logout.mutate()} />
    </aside>
  );
}
