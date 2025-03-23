package main

import (
	"context"
	"fmt"
	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"strings"
	"strconv"
	"time"
	"regexp"
)

 
func startCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: update.Message.Chat.ID,
		Text:   "This is a handler example!",
	})
	if err != nil {
		fmt.Println("Error while sending message:", err)
	}
}

 
func muteCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	userID := update.Message.From.ID
	if !isAdmin(int(userID)) {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "У вас нет прав для выполнения этой команды.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	args := strings.Fields(update.Message.Text)
	if len(args) < 3 {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат команды. Используйте: /mute <user_id> <duration>",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	userId, err := strconv.ParseInt(args[1], 10, 64)
	if err != nil {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат ID пользователя.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	duration, err := parseDuration(args[2])
	if err != nil {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат времени. Используйте, например, '1h' или '30m'.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	muteUser(userId, update.Message.Chat.ID, duration, b, database, ctx)
}

func unmuteCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	userID := update.Message.From.ID
	if !isAdmin(int(userID)) {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "У вас нет прав для выполнения этой команды.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	args := strings.Fields(update.Message.Text)
	if len(args) < 2 {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат команды. Используйте: /unmute <user_id>",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	userId, err := strconv.ParseInt(args[1], 10, 64)
	if err != nil {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат ID пользователя.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	unmuteUser(userId, update.Message.Chat.ID, b, database, ctx)
}

func isAdmin(userId int) bool {
	for _, admin := range config.Admins {
		if admin == userId {
			return true
		}
	}
	return false
}

func parseDuration(duration string) (time.Duration, error) {
	re := regexp.MustCompile(`^(\d+)(h|m)$`)
	matches := re.FindStringSubmatch(duration)
	if len(matches) != 3 {
		return 0, fmt.Errorf("invalid duration format")
	}

	value, _ := strconv.Atoi(matches[1])
	unit := matches[2]

	if unit == "h" {
		return time.Duration(value) * time.Hour, nil
	} else if unit == "m" {
		return time.Duration(value) * time.Minute, nil
	}

	return 0, fmt.Errorf("unsupported time unit")
}
