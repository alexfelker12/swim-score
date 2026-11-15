import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  AlertTriangle,
  ChevronLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  MailCheck,
  Plus,
  Trophy,
  UserMinus,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { DateInput } from "@/components/ui/date-input"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  RadioCard,
  RadioCardDescription,
  RadioCardTitle,
  RadioGroup,
} from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GoogleIcon } from "@/components/icons/google-icon"

/**
 * Temporary, unlinked overview of every shadcn variant (#40), to compare them
 * with docs/design/screens. Removed with #46.
 */
export const Route = createFileRoute("/ui-preview")({
  component: UiPreview,
})

function UiPreview() {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <main className="mx-auto flex max-w-125 flex-col gap-6 p-5">
      <h1>UI-Vorschau</h1>

      <section className="flex flex-col gap-2.5">
        <Button size="xl">Spiel starten</Button>
        <Button size="lg">Speichern</Button>
        <Button variant="secondary" size="xl">
          Zur Gruppe
        </Button>
        <Button variant="destructive" size="xl">
          Spieler entfernen
        </Button>
        <div className="flex gap-2.5">
          <Button variant="outline" className="flex-1">
            Rückgängig
          </Button>
          <Button variant="bomb" size="xl" className="flex-1">
            Bombe
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="soft" size="xs">
            Übernehmen
          </Button>
          <Button variant="soft" size="icon-lg" aria-label="Hinzufügen">
            <Plus />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Zurück">
            <ChevronLeft />
          </Button>
          <Button variant="destructive-ghost" size="sm">
            Konto löschen
          </Button>
          <Button variant="link">Alle ansehen</Button>
        </div>
        <Button variant="google" size="default">
          <GoogleIcon /> Mit Google anmelden
        </Button>
        <Button size="xl" disabled>
          Deaktiviert
        </Button>
      </section>

      <section className="flex items-center gap-2">
        <Badge variant="primary">Verwalter</Badge>
        <Badge variant="muted">Gast</Badge>
        <Badge variant="muted">du</Badge>
        <Badge variant="dealer">Dealer</Badge>
      </section>

      <Tabs defaultValue="games">
        <TabsList>
          <TabsTrigger value="games">Spiele</TabsTrigger>
          <TabsTrigger value="leaderboard">Rangliste</TabsTrigger>
          <TabsTrigger value="players">Spieler</TabsTrigger>
        </TabsList>
        <TabsContent value="games">Spiele</TabsContent>
        <TabsContent value="leaderboard">Rangliste</TabsContent>
        <TabsContent value="players">Spieler</TabsContent>
      </Tabs>

      <section className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="name">Anzeigename</FieldLabel>
          <Input id="name" defaultValue="Anna" />
          <FieldDescription>
            Sichtbar in Spielen und Ranglisten.
          </FieldDescription>
        </Field>
        <Field data-invalid>
          <FieldLabel htmlFor="mail">E-Mail</FieldLabel>
          <Input id="mail" aria-invalid defaultValue="anna@" />
          <FieldError>Bitte eine gültige E-Mail-Adresse eingeben.</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="user">Benutzername</FieldLabel>
          <Input id="user" readOnly value="anna" />
        </Field>
        <Field>
          <FieldLabel htmlFor="pw">Passwort</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="pw"
              type={shown ? "text" : "password"}
              defaultValue="geheim123"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon"
                aria-label={shown ? "Passwort verbergen" : "Passwort anzeigen"}
                aria-pressed={shown}
                onClick={() => setShown(!shown)}
              >
                {shown ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <InputGroup>
          <InputGroupInput
            readOnly
            value="swim-score.app/einladung/x7Kq"
            aria-label="Einladungslink"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon"
              variant="outline"
              aria-label={copied ? "Kopiert" : "Link kopieren"}
              onClick={() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <Check /> : <Copy />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <div className="grid grid-cols-2 gap-2.5">
          <Field>
            <FieldLabel htmlFor="from">Von</FieldLabel>
            <DateInput id="from" defaultValue="2026-01-01" />
          </Field>
          <Field>
            <FieldLabel htmlFor="to">Bis</FieldLabel>
            <DateInput id="to" defaultValue="2026-11-15" />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="theme">Darstellung</FieldLabel>
          <NativeSelect id="theme" defaultValue="dark" className="w-full">
            <NativeSelectOption value="system">System</NativeSelectOption>
            <NativeSelectOption value="light">Hell</NativeSelectOption>
            <NativeSelectOption value="dark">Dunkel</NativeSelectOption>
          </NativeSelect>
        </Field>
      </section>

      <RadioGroup defaultValue="new" aria-label="Wer bist du?">
        <RadioCard value="new">
          <RadioCardTitle>Ich bin neu hier</RadioCardTitle>
          <RadioCardDescription>
            Als neuer Spieler beitreten
          </RadioCardDescription>
        </RadioCard>
        <RadioCard value="emil">
          <RadioCardTitle>Ich bin Emil</RadioCardTitle>
          <RadioCardDescription>Gast, 12 Spiele</RadioCardDescription>
        </RadioCard>
      </RadioGroup>

      <Alert>
        <MailCheck />
        <AlertDescription>
          Link unterwegs. Schau in dein Postfach.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertDescription>Das hat nicht geklappt.</AlertDescription>
      </Alert>

      <section>
        <Item variant="row" size="list">
          <ItemMedia>
            <Avatar>
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              Anna <Badge variant="primary">Verwalter</Badge>
            </ItemTitle>
            <ItemDescription>71 Spiele</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="icon" aria-label="Anna entfernen">
              <UserMinus />
            </Button>
          </ItemActions>
        </Item>
        <Item variant="row" size="list">
          <ItemMedia>
            <Avatar variant="guest">
              <AvatarFallback>E</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              Emil <Badge variant="muted">Gast</Badge>
            </ItemTitle>
          </ItemContent>
        </Item>
        <div className="flex gap-3 pt-3">
          <Avatar size="md">
            <AvatarFallback>B</AvatarFallback>
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>C</AvatarFallback>
          </Avatar>
          <Avatar size="xl">
            <AvatarFallback>D</AvatarFallback>
          </Avatar>
        </div>
      </section>

      <Item variant="card">
        <ItemContent>
          <ItemTitle>Donnerstagsrunde</ItemTitle>
          <ItemDescription>8 Spieler · Platz 2</ItemDescription>
        </ItemContent>
      </Item>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Platz</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Leben</TableHead>
            <TableHead>Bomben</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>1</TableCell>
            <TableCell>Anna</TableCell>
            <TableCell>−1</TableCell>
            <TableCell>2</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>2</TableCell>
            <TableCell>Ben</TableCell>
            <TableCell>−3</TableCell>
            <TableCell>0</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <FieldSeparator>oder</FieldSeparator>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-14" />
      </div>

      <section className="flex flex-col gap-2.5">
        <Drawer>
          <DrawerTrigger render={<Button variant="secondary" />}>
            Sheet: Schwimmer wählen
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Wer wird Schwimmer?</DrawerTitle>
              <DrawerDescription>
                Die Bombe trifft Anna und Ben mit dem letzten Leben.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button variant="outline" size="xl">
                Anna
              </Button>
              <Button variant="outline" size="xl">
                Ben
              </Button>
              <DrawerClose render={<Button variant="secondary" size="xl" />}>
                Bombe zurücknehmen
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <Drawer>
          <DrawerTrigger render={<Button variant="secondary" />}>
            Sheet: Gewinner
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader align="center">
              <DrawerTitle>
                <Trophy />
                Anna gewinnt
              </DrawerTitle>
              <DrawerDescription>Stimmt das?</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button size="xl">Spiel beenden</Button>
              <DrawerClose render={<Button variant="secondary" size="xl" />}>
                Zurück, falsch getippt
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <Drawer>
          <DrawerTrigger render={<Button variant="secondary" />}>
            Sheet: Warnung
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>
                <AlertTriangle />
                Ben ist noch online
              </DrawerTitle>
              <DrawerDescription>
                Wenn du übernimmst, kann Ben nicht mehr zählen.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <Button variant="destructive" size="xl">
                Trotzdem übernehmen
              </Button>
              <DrawerClose render={<Button variant="secondary" size="xl" />}>
                Abbrechen
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <Dialog>
          <DialogTrigger render={<Button variant="secondary" />}>
            Vollbild-Dialog
          </DialogTrigger>
          <DialogContent variant="fullscreen">
            <DialogHeader>
              <DialogTitle>Bild anpassen</DialogTitle>
            </DialogHeader>
            <div className="flex-1" />
            <DialogFooter>
              <DialogClose render={<Button variant="secondary" size="lg" />}>
                Abbrechen
              </DialogClose>
              <Button size="lg">Übernehmen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </main>
  )
}
