import "server-only";
import braintree from "braintree";
import { getServerEnv } from "@/lib/env";
import { assertSandboxOnly } from "@/lib/guards/sandbox";

let gateway: braintree.BraintreeGateway | undefined;

/**
 * The one place a payments connection is created. The environment is the
 * sandbox, written as a constant: there is no setting that selects live.
 */
export function getGateway(): braintree.BraintreeGateway {
  if (!gateway) {
    assertSandboxOnly(process.env);
    const env = getServerEnv();
    gateway = new braintree.BraintreeGateway({
      environment: braintree.Environment.Sandbox,
      merchantId: env.BRAINTREE_MERCHANT_ID,
      publicKey: env.BRAINTREE_PUBLIC_KEY,
      privateKey: env.BRAINTREE_PRIVATE_KEY,
    });
  }
  return gateway;
}
