import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import PapaInbox from "./PapaInbox";
import PapaHoldings from "./PapaHoldings";
import PapaActions from "./PapaActions";
import PapaLedger from "./PapaLedger";
import PapaTeam from "./PapaTeam";

const SECTIONS = [
  { key: "inbox", label: "Inbox" },
  { key: "holdings", label: "Holdings" },
  { key: "actions", label: "Actions" },
  { key: "ledger", label: "Money in/out" },
  { key: "team", label: "Team" },
];

export default function PapaAccountsManager({ ownerId, isOwner, userEmail }) {
  const [section, setSection] = useState("inbox");
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [itemsToken, setItemsToken] = useState(0);
  const [membersToken, setMembersToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from("papa_items")
      .select("*")
      .eq("manager_id", ownerId)
      .order("institution", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
      .then(({ data, error: loadError }) => {
        if (!isMounted) return;
        if (loadError) setError(loadError.message);
        else setItems(data || []);
      });
    return () => {
      isMounted = false;
    };
  }, [ownerId, itemsToken]);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from("papa_members")
      .select("*")
      .eq("manager_id", ownerId)
      .order("created_at", { ascending: true })
      .then(({ data, error: loadError }) => {
        if (!isMounted) return;
        if (loadError) setError(loadError.message);
        else setMembers(data || []);
      });
    return () => {
      isMounted = false;
    };
  }, [ownerId, membersToken]);

  const userName = useMemo(() => {
    const me = members.find(
      (m) => m.email && m.email.toLowerCase() === userEmail?.toLowerCase()
    );
    return me?.name || userEmail?.split("@")[0] || "";
  }, [members, userEmail]);

  const assignees = useMemo(() => {
    const names = members.map((m) => m.name);
    if (userName && !names.includes(userName)) names.unshift(userName);
    return names;
  }, [members, userName]);

  const reloadItems = () => setItemsToken((t) => t + 1);
  const reloadMembers = () => setMembersToken((t) => t + 1);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          18 Papa Accounts
        </h2>
        <p className="text-sm text-slate-500">
          Papa's bank accounts, stocks, mutual funds and more — and what we
          need to do about them.
        </p>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              section === s.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {section === "inbox" && (
        <PapaInbox
          ownerId={ownerId}
          userName={userName}
          items={items}
          reloadItems={reloadItems}
        />
      )}
      {section === "holdings" && (
        <PapaHoldings ownerId={ownerId} items={items} reloadItems={reloadItems} />
      )}
      {section === "actions" && (
        <PapaActions ownerId={ownerId} items={items} assignees={assignees} />
      )}
      {section === "ledger" && <PapaLedger ownerId={ownerId} items={items} />}
      {section === "team" && (
        <PapaTeam
          ownerId={ownerId}
          isOwner={isOwner}
          members={members}
          reloadMembers={reloadMembers}
        />
      )}
    </div>
  );
}
