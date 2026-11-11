# Swim Score

Swim Score tracks games of the card game Schwimmen for fixed groups of friends, live at the table, and ranks players across those games. The UI is German; code and this glossary use English terms with the German display name in parentheses.

## Language

### Structure

**Group** (Gruppe):
A fixed circle of people who play Schwimmen together, with its own players and games.
_Avoid_: Tracker, Runde, Tisch

**Game** (Spiel):
One match of Schwimmen within a Group, from the first deal until a single player is left.
_Avoid_: Match, Partie

**Round** (Runde):
One step of a Game that ends with exactly one outcome: a single player loses the Round, or a player throws a Bomb. Ties are always resolved within the Round by a Tiebreak or an Extra Round.
_Avoid_: Turn, Hand

**Seating Order** (Sitzreihenfolge):
The fixed clockwise order of a Game's Participants, set at the start; the first Participant is the first Dealer.

### Play

**Life** (Leben):
A unit a player loses when a Round goes against them; the Rule Set sets how many each player starts a Game with.
_Avoid_: Heart, Lifes

**Swimmer** (Schwimmer):
The player who would have lost their last Life but keeps playing on it; there is at most one Swimmer per Game, even after they are Out, so anyone losing their last Life after that is Out at once. When a Bomb would put several players Out and nobody has swum yet, the Scorekeeper chooses which of them becomes the Swimmer.
_Avoid_: Swimming player

**Out** (Ausgeschieden):
A player who has lost their last Life (or lost again as the Swimmer); they keep their place in the Seating Order but are skipped as Dealer and take no further part in the Game.
_Avoid_: Dead, Eliminated

**Bomb** (Bombe):
A Round outcome thrown by one player in which every other remaining player loses a Life.
_Avoid_: Nuke

**Tiebreak** (Stechen):
How a Round with several lowest-scoring players is decided when more than two players remain: each tied player draws one card from the rest of the deck, starting from the Dealer clockwise, and the lowest loses; repeated among those still tied.

**Extra Round** (Extra-Runde):
A re-deal by the same Dealer when exactly two players remain and tie; repeated until one of them loses.

**Dealer** (Dealer):
The player who deals the current Round; the role passes to the next remaining player after each Round.

**Winner** (Gewinner):
The last remaining player of a Game.

**Cancelled Game** (Abgebrochenes Spiel):
A Game stopped before it had a Winner; it stays in the Group's history but counts towards no statistic.
_Avoid_: Aborted, Deleted

**Event** (Ereignis):
A single recorded thing that happened in a Game, such as a player losing a Life or throwing a Bomb; the Game's state at any point follows from its Events.
_Avoid_: Action, Snapshot

**Undo** (Rückgängig):
Taking back the last Event of a Game: it is deleted, as if it never happened, and counts nowhere. Only the Scorekeeper undoes, step by step as far back as wanted while the Game runs; after the end, only the last step within about 10 minutes, after which the Game runs again.
_Avoid_: Correction, Revert

**Rule Set** (Regelwerk):
The parameters a Game is played under: number of Participants allowed, starting Lives, whether Bombs exist, whether a Swimmer exists. Every Game currently uses the Standard Rule Set (2 to 9 Participants, 3 Lives, Bomb on, Swimmer on).
_Avoid_: Variant, Mode

### People

**Player** (Spieler):
A person who belongs to a Group, either linked to an account or a Guest.
_Avoid_: Member, User

**Guest** (Gast):
A Player without an account, added by name by any Player with an account, who is recorded as having added them; can later be linked to an account, which then owns the Guest's history. A new Guest may not take the name of a Player already in the Group.

**Participant** (Teilnehmer):
A Player taking part in a specific Game.

**Former Player** (Ehemaliger Spieler):
A Player who was removed from or left a Group; still shown in past Games, but no longer on the Group Leaderboard or selectable for new Games, and no longer able to see the Group. Joining again via the Invite makes them the same Player again. A deleted account becomes an anonymous Former Player, "Ehemaliger Spieler N", numbered per Group.

**Username** (Benutzername):
The name an account signs in with; unique regardless of case and fixed once set. Accounts created with Google get one derived from their e-mail address.
_Avoid_: Login, Handle

**Display Name** (Anzeigename):
The freely changeable name of an account, shown in Games and Leaderboards; it starts out as the Username.
_Avoid_: Nickname

**Group Admin** (Verwalter):
The Player with an account who manages a Group: invites people, removes Players, links Guests to accounts, renames the Group. Starts as the Group's creator and can be handed over to another Player with an account. Adding Guests is not reserved to the Group Admin. The Group Admin cannot leave the Group; they hand over the role first. Nor can they delete their account while other Players with an account are in the Group. When they do delete it, a Group in which no other account ever played is deleted with it; one where only Former Players have accounts stays without a Group Admin, for their past Games, and nobody can see or join it.
_Avoid_: Owner, Creator

**Invite** (Einladung):
A link or QR code that lets a person join a Group, or claim an existing Guest in it. The only way into a Group. Each Group has one, valid until the Group Admin renews it, which makes the old link and code invalid.

**Claim** (Anfrage):
A joining account's statement "I am this Guest". The account is a Player at once; when the Group Admin confirms the Claim, the Guest is merged into that Player, who then owns the Guest's Games. A rejected Claim leaves both as they were. The Group Admin can also merge a Guest into a Player with an account without a Claim. Two Players who sat in the same Game cannot be merged.
_Avoid_: Request, Link request

**Spectator** (Zuschauer):
Anyone watching a running Game read-only via its link, with or without an account.

**Scorekeeper** (Zähler):
The one Participant with an account who records Events for a Game; any other Participant with an account can take over, except during a short grace period while the current Scorekeeper is offline.
_Avoid_: Admin, Host

### Statistics

**Group Leaderboard** (Gruppen-Rangliste):
The ranking of a Group's Players, Guests included, over that Group's completed Games; visible only to the Group's Players.
_Avoid_: Global leaderboard

**Personal Stats** (Persönliche Statistik):
One account holder's statistics across all Groups they play in, in total and per Group, shown on their Player Profile.

**Player Profile** (Spielerprofil):
The page of an account holder showing their Personal Stats; visible to anyone who shares at least one Group with them, with the per-Group breakdown limited to Groups they share.

**Unbreakable**:
Winning a Game while being its Swimmer.

**Untouchable**:
Winning a Game without losing a single Life.
