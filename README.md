# n8n-nodes-mailgraf

This is an n8n community node. It lets you use [MailGraf](https://mailgraf.com) in your n8n workflows.

MailGraf is an email marketing platform for newsletters, campaigns and automations. This package adds two nodes: **MailGraf** (actions) and **MailGraf Trigger** (instant webhooks).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[MailGraf Trigger](#mailgraf-trigger)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `n8n-nodes-mailgraf`.

## Operations

### Contact

- **Create or Update**: creates a contact, or updates the contact with the same email address. Optional first name, last name, country, custom fields and list. Switch on **Double Opt-In** to send a confirmation email instead; MailGraf creates the contact (and adds the list) only after the link is clicked.
- **Get**: by email address or contact ID.
- **Get Many**: newest first, with cursor pagination handled for you.
- **Add to List**: adds a contact to a list, creating the contact if it does not exist.
- **Remove From List**: removes the membership; the contact stays in the account.
- **Unsubscribe**: sets the contact to unsubscribed. There is no way back to active through the API; the contact has to opt in again.
- **Block**: adds an email address to the account block list.

### Event

- **Send**: records a custom event (for example `order_paid`) for an existing contact. An automation in MailGraf can start on that event. Optional properties (JSON, up to 8 KB), timestamp within the last 24 hours, and a deduplication key that makes retries safe.

### List

- **Get Many**: lists with their IDs.

### Campaign

- **Get Many**: campaigns, newest first.
- **Get Report**: recipients, deliveries, opens, clicks, bounces, complaints and unsubscribes for one campaign.

### Custom Field

- **Get Many**: the custom fields defined in the account, with their keys, types and options.

## MailGraf Trigger

The trigger registers a webhook in MailGraf when the workflow is activated and removes it when the workflow is deactivated. MailGraf posts each event the moment it happens. Events:

- Contact Confirmed (double opt-in)
- Contact Unsubscribed
- Email Bounced
- Contact Complained (spam report)
- Email Delivered
- Campaign Sent
- Form Submitted
- Contact Added to List / Removed From List
- Contact Tagged / Untagged

Each item carries `event`, `event_id`, `occurred_at`, `contact_id`, `email`, `campaign_id`, `campaign_name`, any event details (for example `sub_type`), and the full `payload`. Deliveries are signed with `X-MailGraf-Signature`; the trigger verifies the signature with the webhook's secret and rejects anything else with 401.

A MailGraf account can hold up to 10 webhooks, including those created in Settings. Each active trigger node uses one.

## Credentials

1. In MailGraf, open **Settings > Developers > API** and create a key. The key is shown once; copy it.
2. In n8n, create a **MailGraf API** credential and paste the key. Keep the API base URL unless MailGraf gives you another address.
3. Use the credential in the MailGraf and MailGraf Trigger nodes.

API access depends on the MailGraf plan. If the credential test says the plan does not include API access, upgrade the plan in MailGraf.

## Compatibility

Built and tested with n8n 1.x. Requires Node.js 20 or later for building.

## Usage

- **Google Sheets row → MailGraf contact**: Google Sheets Trigger → MailGraf (Contact: Create or Update, choose a list).
- **Shop order → automation**: your shop's trigger → MailGraf (Contact: Create or Update) → MailGraf (Event: Send, name `order_paid`).
- **Unsubscribe → CRM**: MailGraf Trigger (Contact Unsubscribed) → your CRM node.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [MailGraf API reference](https://api.mailgraf.com/v1/docs)
- [MailGraf help centre](https://mailgraf.com/help)

## Version history

- **0.1.1**: package contact address corrected.
- **0.1.0**: first release with the MailGraf node (contacts, lists, events, campaigns, custom fields) and the MailGraf Trigger node.
