import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { WalletView } from "@/components/wallet/wallet-view";
import { requireAuth } from "@/lib/session";
import { ensureStaffWallet } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";
import { listWalletTransactionsAction } from "@/lib/wallet-actions";
import { listMoneyConfirmationsAction } from "@/lib/money-confirmation-actions";
import { getTranslations } from "next-intl/server";

export default async function WalletPage() {
  const user = await requireAuth();
  const tPages = await getTranslations("pages.wallet");
  const wallet = await ensureStaffWallet(prisma, user.id);
  const [{ transactions }, { confirmations }] = await Promise.all([
    listWalletTransactionsAction({
      scope: "mine",
      includeLegacy: true,
      take: 200,
    }),
    listMoneyConfirmationsAction({ scope: "mine", status: "OPEN", take: 40 }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeaderSlot title={tPages("title")} />
      <WalletView
        balanceVnd={wallet.balanceVnd.toString()}
        initialTransactions={transactions}
        confirmations={confirmations}
      />
    </div>
  );
}
