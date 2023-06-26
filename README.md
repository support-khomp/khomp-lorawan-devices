# Device Repository for Khomp LoRaWAN® Devices

Este repositorio contem informações sobre devices LoRaWAN Khomp. 
O repositorio atua como uma fonte de dados dos dispositivos, principalmente relacionada aos codecs.
Aqui voce encontrará exemplos de funções que realizam o processo de decodificação dos payloads (já descriptografados) dos dispositivos.

As funções de decodificação podem ser usadas (copiar/colar) nos seguintes LoRaWAN Network Servers:

- The Things Stack (TTN/TTI)
- ChirpStack

As funções também podem ser usadas como referencia ou incorporadas nas aplicações que integram a rede Everynet.
Para encontrar a função correta para o seu modelo de dispositivo, vá até o diretorio vendor/khomp. Neste diretório voce encontrará diversos arquivos, 
porém o arquivo em questão é o que contém a extensão .js (JavaScript). 

## Introdução sobre o padrão do codec
Os codecs oferecidos pela Khomp seguem o padrão de API da especificação [LoRaWAN® Payload Codec API Specification TS013-1.0.0](https://resources.lora-alliance.org/technical-specifications/ts013-1-0-0-payload-codec-api), que padroniza um JavaScript genérico de codecs para dispositivos LoRaWAN.

## JavaScript API
A linguagem de programação usada nestes codecs é o JavaScript, que é uma linguagem interpretada e compilada just-in-time com funções de primeira classe.
Mais precisamente, é utilizado o JavaScript ES5 (consulte ECMAScript® Language Specification) que é simples e amplamente suportado na maioria das comunidades.



