package main

import (
	"os"
	"fmt"
	"gopkg.in/yaml.v2"
)

type conf struct {
	Token  string `yaml:"token"`
	Admins []int  `yaml:"admins"`
}

func (config *conf) getConf() {
	yamlFile, err := os.ReadFile("config/config.yaml")
	if err != nil {
		panic(fmt.Sprintf("Error while reading config file: %v", err))
	}

	err = yaml.Unmarshal(yamlFile, config)
	if err != nil {
		panic(fmt.Sprintf("Error while parsing config file: %v", err))
	}
}
