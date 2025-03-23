package main

import (
	"context"
	"database/sql"
	"os"
	"os/signal"
	"fmt"

	"github.com/go-telegram/bot"
)

var config conf
var database *sql.DB

func main() {
	config.getConf()
	var err error
	database, err = openDatabase()
	if err != nil {
		panic(err)
	}
	defer database.Close()

	createTables()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	opts := []bot.Option{}
	b, err := bot.New(config.Token, opts...)
	if err != nil {
		panic(fmt.Sprintf("Error while initializing bot: %v", err))
	}

	b.RegisterHandler(bot.HandlerTypeMessageText, "/mute", bot.MatchTypeContains, muteCommandHandler)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/unmute", bot.MatchTypeContains, unmuteCommandHandler)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/fact", bot.MatchTypeContains, randomFactHandler)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/quote", bot.MatchTypeContains, randomQuoteHandler)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/newyear", bot.MatchTypeContains, daysUntilNewYearHandler)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/summer", bot.MatchTypeContains, daysUntilSummerHandler)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/fetch", bot.MatchTypeContains, fetchCommandHandler)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/warn", bot.MatchTypeContains, warnCommandHandler)
	b.RegisterHandler(bot.HandlerTypeMessageText, "/unwarn", bot.MatchTypeContains, unwarnCommandHandler)

	b.Start(ctx)
}
